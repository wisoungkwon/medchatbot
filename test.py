# test.py
import os
import re
import json
from typing import List, Dict, Iterable, Optional

from flask import Flask, request, jsonify, Response, stream_with_context
from flask_cors import CORS

# Embedding / Vector search
from langchain.embeddings import HuggingFaceEmbeddings
from langchain.vectorstores import FAISS

# OpenAI-compatible client (official or gateway)
from openai import OpenAI

app = Flask(__name__)
CORS(app)

# ──────────────────────────────────────────────────────────────────────────────
# OpenAI / Gateway client
# ──────────────────────────────────────────────────────────────────────────────
API_KEY = os.getenv("OPENAI_API_KEY", "sktax-XyeKFrq67ZjS4EpsDlrHHXV8it")
BASE_URL = os.getenv("OPENAI_BASE_URL", "https://guest-api.sktax.chat/v1")
client = OpenAI(api_key=API_KEY, base_url=BASE_URL)

# ──────────────────────────────────────────────────────────────────────────────
# Embedding model (유지요청 반영)
# ──────────────────────────────────────────────────────────────────────────────
embedding_model = HuggingFaceEmbeddings(model_name="jhgan/ko-sbert-sts")

vectorstore: Optional[FAISS] = None
if os.path.exists("./faiss_index"):
    try:
        vectorstore = FAISS.load_local(
            "./faiss_index", embedding_model, allow_dangerous_deserialization=True
        )
    except Exception:
        vectorstore = None

# 세션별 대화 저장소 (데모용)
user_sessions: Dict[str, List[Dict[str, str]]] = {}

# ──────────────────────────────────────────────────────────────────────────────
# System prompt (간결 규칙 추가)
# ──────────────────────────────────────────────────────────────────────────────
SYSTEM_TEMPLATE = """당신은 전문적인 의학 상담 챗봇입니다.
사용자가 제시하는 증상과 환자 기본정보(나이/성별/기저질환)를 바탕으로 가능한 감별진단을 **근거 있게** 제시하세요.
의학 용어는 지나치게 난해하지 않게 풀어 쓰고, 불필요한 일반론·중복은 피합니다.
"""

# 답변을 짧고 또렷하게 만들기 위한 강한 출력 규칙(백엔드에서 톤/길이 고정)
CONCISE_GUIDE = """
출력 규칙(매우 중요):
- 아래 1~5 섹션 형식을 반드시 유지.
- 섹션당 불릿은 최대 3개.
- 한 불릿은 한 문장(권장 40~120자). 장문/중복/사전식 설명 금지.
- 응급 경고는 해당될 때만 간단히.
- 임상적으로 실행 가능한 조언만. 모호한 표현·반복 금지.

출력 형식:
1. 예상되는 병명 (2~3가지)
2. 주요 원인
3. 추천 진료과 (2~3과)
4. 예방 및 관리 방법
5. 생활 시 주의사항
"""


# ──────────────────────────────────────────────────────────────────────────────
# Utilities
# ──────────────────────────────────────────────────────────────────────────────
def pretty_gender(g: Optional[str]) -> str:
    g = (g or "").lower().strip()
    if g in ("m", "male", "남", "남자"):
        return "남자"
    if g in ("f", "female", "여", "여자"):
        return "여자"
    return g or "미상"


def format_patient_info(patient: Optional[dict]) -> str:
    if not patient:
        return "연령/성별/기저질환 정보 없음"
    age = str(patient.get("age") or "미상").strip()
    gender = pretty_gender(patient.get("gender"))
    cond = (patient.get("conditions") or "").strip() or "없음"
    return f"- 연령: {age}\n- 성별: {gender}\n- 기저질환/특이사항: {cond}"


def retrieve_context(
    query: str, patient: Optional[dict], k: int = 12, max_chars: int = 1500
) -> str:
    """증상 + 기저질환 키워드로 검색 컨텍스트 구성"""
    if not vectorstore:
        return ""
    try:
        cond = (patient or {}).get("conditions") or ""
        q = f"{query} {cond}".strip()
        docs = vectorstore.similarity_search(q, k=k)
        ctx = "\n---\n".join(d.page_content for d in docs)
        return ctx[:max_chars]
    except Exception:
        return ""


# ── 길이/밀도 후처리(항상 짧게 유지하기 위한 안전망) ─────────────────────────────
def clamp_bullets(
    bullets: List[str], max_items: int = 3, max_len: int = 120
) -> List[str]:
    out: List[str] = []
    for b in bullets[:max_items]:
        b = " ".join(b.split())  # 공백 정규화
        if len(b) > max_len:
            b = b[:max_len].rstrip() + "…"
        out.append(b)
    return out


def postprocess_to_sections(text: str) -> str:
    """
    1~5 섹션 블록만 남기고, 과도 반복 축소.
    모델이 장문을 생성해도 1~5 범위로 잘라 반환.
    """
    m = re.search(r"1\..*?5\..*", text, flags=re.S)
    out = m.group(0).strip() if m else text.strip()
    # 자주 나오는 중복 종결어미 축소
    out = re.sub(r"(입니다|합니다)(?:\s*\1)+", r"\1", out)
    return out


# 구조화 파서 (마크다운/텍스트 → 섹션 JSON)
SECTION_TITLES = {
    1: "예상되는 병명 (2~3가지)",
    2: "주요 원인",
    3: "추천 진료과 (2~3과)",
    4: "예방 및 관리 방법",
    5: "생활 시 주의사항",
}


def parse_to_structured(markdown: str) -> dict:
    text = markdown.strip()
    m = re.search(r"1\..*?5\..*", text, flags=re.S)
    text = m.group(0) if m else text

    parts = re.split(r"\n\s*(?=(?:###\s*)?\d\.\s)", text)
    sections = []
    for p in parts:
        p = p.strip()
        if not p:
            continue
        m = re.match(r"(?:(?:###\s*)?)(\d)\.\s*(.*)", p, flags=re.S)
        if not m:
            # 번호가 없으면 기타 텍스트로
            sections.append({"title": "기타", "bullets": [p]})
            continue
        idx = int(m.group(1))
        body = m.group(2).strip()

        bullets: List[str] = []
        # 마크다운 리스트/줄바꿈/문장 단위로 최대한 나눔
        for line in re.split(
            r"\n\s*[-•*]\s+|\n(?=\*\*)|\n\s*\d+\)\s+|\n{2,}", "\n" + body
        ):
            line = line.strip()
            if not line:
                continue
            line = line.replace("**", "").strip()
            if len(line) > 300:
                bullets.extend(
                    [s.strip() for s in re.split(r"(?<=[.!?])\s+", line) if s.strip()]
                )
            else:
                bullets.append(line)

        # 🔒 안전망: 섹션별 최대 N개 / 불릿 길이 제한 적용
        bullets = clamp_bullets(bullets, max_items=3, max_len=120)

        sections.append(
            {
                "index": idx,
                "title": SECTION_TITLES.get(idx, f"{idx}."),
                "bullets": bullets,
            }
        )

    sections = sorted(
        [s for s in sections if "index" in s and 1 <= s["index"] <= 5],
        key=lambda x: x["index"],
    )
    return {"sections": sections}


def to_sse(data: str, event: Optional[str] = None) -> str:
    return (f"event: {event}\n" if event else "") + f"data: {data}\n\n"


def build_messages(
    session_id: str,
    symptom: str,
    patient: Optional[dict],
    retrieved: Optional[str],
    detail: str = "short",  # "short" | "normal" | "deep"
) -> List[Dict[str, str]]:
    """
    detail 파라미터로 길이 정책을 가볍게 조정할 수 있게 했어요.
    - short: 가장 짧게(기본)
    - normal/deep: 프롬프트 규칙을 완화하고 max_tokens을 상향(아래 엔드포인트에서 사용)
    """
    if session_id not in user_sessions:
        user_sessions[session_id] = [{"role": "system", "content": SYSTEM_TEMPLATE}]

    # 길이 정책 힌트
    if detail == "deep":
        guide = CONCISE_GUIDE.replace("불릿은 최대 3개", "불릿은 최대 5개").replace(
            "한 문장", "한두 문장"
        )
    elif detail == "normal":
        guide = CONCISE_GUIDE.replace("불릿은 최대 3개", "불릿은 최대 4개")
    else:
        guide = CONCISE_GUIDE

    msgs = list(user_sessions[session_id])
    msgs.append({"role": "system", "content": guide})
    msgs.append(
        {"role": "system", "content": "[환자 정보]\n" + format_patient_info(patient)}
    )
    if symptom:
        msgs.append({"role": "system", "content": "[사용자 증상]\n" + symptom})
    if retrieved:
        msgs.append(
            {"role": "system", "content": "[참고 자료 - 반드시 반영]\n" + retrieved}
        )

    # 최근 히스토리 유지
    sys_cnt = sum(1 for m in msgs if m["role"] == "system")
    msgs = msgs[:sys_cnt] + msgs[sys_cnt:][-12:]
    msgs.append(
        {
            "role": "user",
            "content": "위 정보를 모두 반영해 1~5 섹션 형식으로 작성해 주세요.",
        }
    )
    return msgs


# ──────────────────────────────────────────────────────────────────────────────
# /chat (JSON)
# ──────────────────────────────────────────────────────────────────────────────
@app.route("/chat", methods=["POST"])
def chat():
    payload = request.get_json(force=True, silent=True) or {}
    symptom = payload.get("message") or payload.get("symptom") or ""
    patient = payload.get("patient") or {}
    session_id = payload.get("session_id") or "default"
    detail = payload.get("detail") or "short"

    retrieved = retrieve_context(symptom, patient)
    messages = build_messages(
        session_id, symptom, patient, retrieved or None, detail=detail
    )

    # 길이 정책에 따른 토큰 상한
    max_tok = 700 if detail == "short" else (900 if detail == "normal" else 1200)

    resp = client.chat.completions.create(
        model="ax4",
        messages=messages,
        temperature=0.25,  # 장황함 억제
        max_tokens=max_tok,  # 상한 낮춰 길이 제어
        stream=False,
    )

    raw = (resp.choices[0].message.content or "").strip()
    answer = postprocess_to_sections(raw)
    structured = parse_to_structured(answer)

    user_sessions.setdefault(
        session_id, [{"role": "system", "content": SYSTEM_TEMPLATE}]
    )
    user_sessions[session_id].append({"role": "assistant", "content": answer})

    return jsonify({"response": answer, "structured": structured})


# ──────────────────────────────────────────────────────────────────────────────
# /chat/stream (SSE: token stream + meta 구조화)
# ──────────────────────────────────────────────────────────────────────────────
@app.route("/chat/stream", methods=["POST"])
def chat_stream():
    payload = request.get_json(force=True, silent=True) or {}
    symptom = payload.get("message") or payload.get("symptom") or ""
    patient = payload.get("patient") or {}
    session_id = payload.get("session_id") or "default"
    detail = payload.get("detail") or "short"

    retrieved = retrieve_context(symptom, patient)
    messages = build_messages(
        session_id, symptom, patient, retrieved or None, detail=detail
    )

    # 길이 정책에 따른 토큰 상한
    max_tok = 700 if detail == "short" else (900 if detail == "normal" else 1200)

    def generate() -> Iterable[str]:
        stream = client.chat.completions.create(
            model="ax4",
            messages=messages,
            temperature=0.25,
            max_tokens=max_tok,
            stream=True,
        )
        chunks: List[str] = []
        for part in stream:
            delta = part.choices[0].delta.content or ""
            if not delta:
                continue
            chunks.append(delta)
            yield to_sse(delta)

        # 최종 텍스트 정리
        final_text = postprocess_to_sections("".join(chunks))

        user_sessions.setdefault(
            session_id, [{"role": "system", "content": SYSTEM_TEMPLATE}]
        )
        user_sessions[session_id].append({"role": "assistant", "content": final_text})

        # 구조화 JSON meta 이벤트(불릿/길이 클램핑 적용)
        meta = parse_to_structured(final_text)
        yield to_sse(json.dumps(meta, ensure_ascii=False), event="meta")

        # 종료 신호
        yield to_sse("[DONE]", event="done")

    headers = {
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "Content-Type": "text/event-stream; charset=utf-8",
        "X-Accel-Buffering": "no",
    }
    return Response(stream_with_context(generate()), headers=headers)


@app.route("/healthz")
def healthz():
    return "ok", 200


if __name__ == "__main__":
    # 운영은 gunicorn/uvicorn 권장
    app.run(host="0.0.0.0", port=5050)
