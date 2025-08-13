import os
import json
import re
from flask import Flask, request, jsonify
from flask_cors import CORS
from langchain.embeddings import HuggingFaceEmbeddings
from langchain.vectorstores import FAISS
from openai import OpenAI
from rapidfuzz import fuzz

# Flask 초기화
app = Flask(__name__)
CORS(app)

# SBERT 임베딩 모델 로드
embedding_model = HuggingFaceEmbeddings(model_name="jhgan/ko-sbert-sts")

# JSON 데이터 폴더 및 FAISS 저장 경로
json_folder = "./json_diseases_final"
db_path = "vector_db/faiss_db_json"
os.makedirs("vector_db", exist_ok=True)


# dict 필드 추출 함수
def extract_text(field_dict):
    if not isinstance(field_dict, dict):
        return ""
    texts = []
    for v in field_dict.values():
        if isinstance(v, list):
            texts.append("\n".join(map(str, v)))
        elif isinstance(v, str):
            texts.append(v)
        else:
            texts.append(str(v))
    return "\n".join(texts)


# 인덱스가 없을 경우 FAISS 생성
if not os.path.exists(os.path.join(db_path, "index.faiss")):
    texts = []
    for filename in os.listdir(json_folder):
        if not filename.endswith(".json"):
            continue
        with open(os.path.join(json_folder, filename), encoding="utf-8") as f:
            data = json.load(f)
        disease = data.get("병명", "")
        정의 = extract_text(data.get("정의", {}))
        원인 = extract_text(data.get("원인", {}))
        증상 = extract_text(data.get("증상", {}))
        진단 = extract_text(data.get("진단", {}))
        치료 = extract_text(data.get("치료", {}))
        full_text = f"[병명] {disease}\n[정의] {정의}\n[원인] {원인}\n[증상] {증상}\n[진단] {진단}\n[치료] {치료}"
        if full_text:
            texts.append(full_text)
    db = FAISS.from_texts(texts, embedding=embedding_model)
    db.save_local(db_path)

# 벡터 DB 로드
db = FAISS.load_local(db_path, embedding_model, allow_dangerous_deserialization=True)

# LLM 클라이언트 초기화
client = OpenAI(
    base_url="https://guest-api.sktax.chat/v1",
    api_key="sktax-XyeKFrq67ZjS4EpsDlrHHXV8it",
)

system_content = """
당신은 의료 상담 챗봇입니다.
사용자 질문이 건강/증상/의학 관련이면, 아래 [증상 정보]를 참고하여 1~5번 항목을 작성하세요.
반드시 존댓말(-입니다, -합니다)로 답변하며, 내부 생각은 출력하지 않습니다.
비의료 질문(음식, 여행 등)이면 [증상 정보]를 무시하고 자유롭게 답변하세요.

📝 출력 형식:
1. 예상되는 병명 (2~3가지): (첫 번째 병명은 간단한 설명도 포함)
2. 주요 원인:
3. 추천 진료과 (2~3과):
4. 예방 및 관리 방법:
5. 생활 시 주의사항:

(비의료 질문일 경우)
답변:
""".strip()

# 멀티턴 메시지 관리용
user_sessions = {}


@app.route("/chat", methods=["POST"])
def chat():
    data = request.get_json()
    user_input = data.get("message", "")
    session_id = data.get(
        "session_id", "default"
    )  # 프론트에서 유저별로 구분 가능하게 세션ID 넘기면 좋음

    # 세션별 메시지 스택 초기화
    if session_id not in user_sessions:
        user_sessions[session_id] = [{"role": "system", "content": system_content}]
        # 첫 질의마다 증상 정보 추가
        docs = db.similarity_search(user_input, k=10)
        retrieved_context = "\n---\n".join([doc.page_content for doc in docs])[:1000]
        user_sessions[session_id].append(
            {"role": "system", "content": f"[증상 정보]\n{retrieved_context}"}
        )

    # 사용자 메시지 추가
    user_sessions[session_id].append({"role": "user", "content": user_input})

    # 모델 호출
    response = client.chat.completions.create(
        model="ax4", messages=user_sessions[session_id]
    )
    answer = response.choices[0].message.content.strip()

    # 1~5 항목만 추출
    if "1." in answer and "2." in answer:
        match = re.search(r"1\..*?5\..*", answer, flags=re.DOTALL)
        answer_only = match.group().strip() if match else answer
        answer_only = re.sub(r"(입니다|합니다)\1+", r"\1", answer_only)
    else:
        answer_only = answer

    # assistant 응답 누적
    user_sessions[session_id].append({"role": "assistant", "content": answer_only})

    return jsonify({"response": answer_only})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5050)
