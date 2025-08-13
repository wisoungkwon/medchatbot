document.addEventListener("DOMContentLoaded", function() {
	/* =========================
	   API 경로
	========================= */
	const API_CHAT = "http://localhost:5050/chat";
	const SAVE_URL = "/api/diagnosis-history"; // 백엔드 엔드포인트에 맞게 필요 시 변경

	/* =========================
	   공통 요소
	========================= */
	const chat = document.getElementById("chat");
	const input = document.getElementById("userInput");
	const sendBtn = document.getElementById("sendBtn");

	/* =========================
	   환자 조회/표시 요소
	========================= */
	const patientIdInput = document.getElementById("patientIdInput");
	const patientLookupBtn = document.getElementById("patientLookupBtn");
	const profileSection = document.getElementById("profileSection");
	const historySection = document.getElementById("historySection");
	const historyBody = document.getElementById("history-table-body");
	const historyEmpty = document.getElementById("history-empty");
	const panelToggleBtn = document.getElementById("panelToggleBtn");
	const historyCloseBtn = document.getElementById("historyCloseBtn");

	const elId = document.getElementById("patient-id");
	const elAge = document.getElementById("patient-age");
	const elGender = document.getElementById("patient-gender");
	const elCond = document.getElementById("patient-conditions");

	// 현재 조회한 회원 ID (회원 조회가 되었을 때만 저장)
	let currentPatientId = null;

	/* =========================
	   유틸
	========================= */
	function escapeHtml(s) {
		return String(s)
			.replaceAll("&", "&amp;")
			.replaceAll("<", "&lt;")
			.replaceAll(">", "&gt;")
			.replaceAll('"', "&quot;")
			.replaceAll("'", "&#039;");
	}
	function fmt(dt) {
		try {
			return new Date(dt).toLocaleString("ko-KR", { dateStyle: "medium", timeStyle: "short" });
		} catch { return dt ?? ""; }
	}
	function show(el) { if (!el) return; el.classList?.remove("hidden"); el.style.display = "block"; }
	function hide(el) { if (!el) return; el.classList?.add("hidden"); el.style.display = "none"; }
	function isVisible(el) { return !!el && el.style.display !== "none"; }
	function updatePanelToggleLabel() {
		const bothVisible = isVisible(profileSection) && isVisible(historySection);
		panelToggleBtn && (panelToggleBtn.textContent = bothVisible ? "접기" : "펼치기");
	}
	function setPanelsVisible(visible) {
		if (visible) {
			show(profileSection); show(historySection);
			localStorage.setItem("patientPanels", "on");
		} else {
			hide(profileSection); hide(historySection);
			localStorage.setItem("patientPanels", "off");
		}
		updatePanelToggleLabel();
	}

	// 초기 패널 상태 복원
	if (localStorage.getItem("patientPanels") === "off") setPanelsVisible(false);
	else updatePanelToggleLabel();

	/* =========================
	   렌더링
	========================= */
	function renderPatientProfile(data) {
		elId.textContent = data.id ?? "";
		elAge.textContent = data.age ?? "";
		elGender.textContent = data.gender === "m" ? "남자" : (data.gender === "f" ? "여자" : (data.gender ?? ""));
		elCond.textContent = !data.conditions || data.conditions.trim() === "" ? "없음" : data.conditions;
		show(profileSection);
	}

	function renderHistory(list = []) {
		historyBody.innerHTML = "";
		if (!list || list.length === 0) {
			show(historySection); show(historyEmpty); return;
		}
		hide(historyEmpty);
		list.forEach((r) => {
			const tr = document.createElement("tr");
			tr.innerHTML = `
        <td>${fmt(r.chatDate)}</td>
        <td>${escapeHtml(r.symptoms ?? "")}</td>
        <td>${escapeHtml(r.predictedDiagnosis ?? "")}</td>
        <td>${escapeHtml(r.recommendedDepartment ?? "")}</td>
        <td>${escapeHtml(r.additionalInfo ?? "")}</td>
      `;
			historyBody.appendChild(tr);
		});
		show(historySection);
	}

	async function loadPatientData(patientId) {
		if (!patientId) return;
		try {
			const res = await fetch(`/patient/${encodeURIComponent(patientId)}`);
			if (!res.ok) { hide(profileSection); hide(historySection); throw new Error("환자 정보를 찾을 수 없습니다."); }
			const data = await res.json();
			currentPatientId = data.id || patientId;     // ✅ 저장용 ID 보관
			window.currentPatientId = currentPatientId;  // (필요 시 다른 모듈에서 접근)
			renderPatientProfile(data);
			renderHistory(data.history || []);
			setPanelsVisible(true);                      // 조회 시 자동 펼치기
		} catch (e) {
			alert(e.message || "조회 중 오류가 발생했습니다.");
			console.error(e);
		}
	}

	/* =========================
	   이벤트 (조회/토글/닫기)
	========================= */
	patientLookupBtn?.addEventListener("click", () => {
		const id = patientIdInput.value.trim();
		loadPatientData(id);
	});
	patientIdInput?.addEventListener("keydown", (e) => {
		if (e.key === "Enter") { e.preventDefault(); patientLookupBtn?.click(); }
	});

	// 상단 접기/펼치기 버튼 → 두 패널 동시 토글
	panelToggleBtn?.addEventListener("click", () => {
		const visible = isVisible(profileSection) && isVisible(historySection);
		setPanelsVisible(!visible);
	});

	// X 아이콘 → 과거 진단만 닫기
	historyCloseBtn?.addEventListener("click", () => {
		hide(historySection);
		updatePanelToggleLabel();
	});

	// ESC → 전체 닫기
	document.addEventListener("keydown", (e) => { if (e.key === "Escape") setPanelsVisible(false); });

	/* =========================
	   회원가입 모달
	========================= */
	const signupBtn = document.getElementById("signupBtn");
	const signupModal = document.getElementById("signupModal");
	const closeSignup = document.getElementById("closeSignup");
	const signupForm = document.getElementById("signupForm");

	signupBtn?.addEventListener("click", () => { if (signupModal) signupModal.style.display = "block"; });
	closeSignup?.addEventListener("click", () => { if (signupModal) signupModal.style.display = "none"; });
	window.addEventListener("click", (e) => { if (e.target === signupModal) signupModal.style.display = "none"; });

	signupForm?.addEventListener("submit", async (e) => {
		e.preventDefault();
		const id = document.getElementById("signupId")?.value?.trim();
		const ageRaw = document.getElementById("signupAge")?.value;
		const genderKo = document.querySelector("input[name='signupGender']:checked")?.value; // '남'/'여'
		const condRaw = document.getElementById("signupCondition")?.value?.trim() || "";
		const conditions = condRaw === "" ? "없음" : condRaw;

		const age = Number(ageRaw);
		if (!id || !age || !genderKo) { alert("필수 항목을 모두 입력해주세요."); return; }
		const gender = (genderKo === "남") ? "m" : "f";

		try {
			const res = await fetch("/patient/register", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ id, age, gender, conditions })
			});
			const text = await res.text();
			if (!res.ok) throw new Error(text || "회원가입 실패");
			alert(text || "회원가입이 완료되었습니다!");
			if (signupModal) signupModal.style.display = "none";
			// 가입 즉시 조회하려면 아래 주석 해제
			// patientIdInput.value = id; patientLookupBtn?.click();
		} catch (err) {
			console.error(err);
			alert(err.message || "오류가 발생했습니다.");
		}
	});

	/* =========================
	   챗봇 (응답 섹션 카드 UI + 저장)
	========================= */
	input?.addEventListener("keydown", (e) => { if (e.key === "Enter") sendMessage(); });
	sendBtn?.addEventListener("click", sendMessage);

	function addMessage(text, sender) {
		const msg = document.createElement("div");
		msg.classList.add("message", sender);
		msg.textContent = text;
		chat.appendChild(msg);
		chat.scrollTop = chat.scrollHeight;
		return msg;
	}

	// (옵션) 타자 효과가 필요한 경우 사용
	function typeWriter(target, text, speed = 18) {
		return new Promise((resolve) => {
			let i = 0;
			(function typing() {
				if (i < text.length) { target.textContent += text[i++]; setTimeout(typing, speed); }
				else resolve();
			})();
		});
	}

	// 섹션 내용 HTML 포맷(글머리표 감지 시 <ul>)
	function formatSectionHtml(text) {
		const lines = text.split(/\n+/).map(s => s.trim()).filter(Boolean);
		if (lines.some(l => /^[-•]/.test(l))) {
			return '<ul>' + lines.map(l => `<li>${escapeHtml(l.replace(/^[-•]\s?/, ''))}</li>`).join('') + '</ul>';
		}
		return `<p>${escapeHtml(text).replace(/\n/g, '<br>')}</p>`;
	}

	// 이전처럼 번호(1.,2.,3.,4.,5.) 기준으로 "카드" 섹션 렌더
	async function showBotAnswer(answer) {
		const sections = String(answer).split(/\n\s*(?=\d+\.\s)/g).filter(Boolean);
		if (sections.length === 0) { addMessage(answer, "bot"); return; }

		for (const sec of sections) {
			const [title, ...rest] = sec.split(/\n/);
			const body = rest.join("\n").trim();

			const box = document.createElement("div");
			box.className = "message bot section";
			box.innerHTML = `
        <div class="section-title">${escapeHtml(title)}</div>
        ${body ? formatSectionHtml(body) : ""}
      `;
			chat.appendChild(box);
			chat.scrollTop = chat.scrollHeight;
		}
	}

	function prependHistoryRow(r) {
		const tbody = document.getElementById("history-table-body");
		const empty = document.getElementById("history-empty");
		if (!tbody) return;

		if (empty) empty.style.display = "none";
		const tr = document.createElement("tr");
		tr.innerHTML = `
      <td>${fmt(r.chatDate || new Date())}</td>
      <td>${escapeHtml(r.symptoms || "")}</td>
      <td>${escapeHtml(r.predictedDiagnosis || "")}</td>
      <td>${escapeHtml(r.recommendedDepartment || "")}</td>
      <td>${escapeHtml(r.additionalInfo || "")}</td>
    `;
		if (tbody.firstChild) tbody.insertBefore(tr, tbody.firstChild);
		else tbody.appendChild(tr);
	}

	// ✅ 번호 섹션(1.~5.)을 제목 키워드로 컬럼 매핑
	function extractDiagnosisParts(result) {
	  const response = (result?.response || "").trim();
	  // 1) 백엔드가 구조화로 주면 그대로 사용
	  const structured = {
	    predictedDiagnosis   : (result?.predictedDiagnosis || "").trim(),
	    diagnosisDefinition  : (result?.diagnosisDefinition || "").trim(),
	    recommendedDepartment: (result?.recommendedDepartment || "").trim(),
	    preventionManagement : (result?.preventionManagement || "").trim(),
	    additionalInfo       : (result?.additionalInfo || "").trim(),
	  };
	  if (Object.values(structured).some(v => v)) return structured;

	  if (!response) return structured;

	  // 2) "1. 제목\n내용 ..." 형태로 분해
	  const blocks = String(response)
	    .split(/\n\s*(?=\d+\.\s)/g)           // 번호 시작으로 분할
	    .map(b => b.trim())
	    .filter(Boolean)
	    .map(b => {
	      const m = b.match(/^\s*(\d+)\.\s*([^\n:：]+)[:：]?\s*/); // "1. 제목:"
	      const title = m ? m[2].trim() : "";
	      const body  = m ? b.slice(m[0].length).trim() : b;
	      return { title, body };
	    });

	  const out = {
	    predictedDiagnosis   : "",
	    diagnosisDefinition  : "",
	    recommendedDepartment: "",
	    preventionManagement : "",
	    additionalInfo       : ""
	  };

	  // 3) 제목 키워드로 분류
	  const put = (key, text) => {
	    if (!text) return;
	    if (out[key]) out[key] += (out[key].endsWith("\n") ? "" : "\n") + text;
	    else out[key] = text;
	  };

	  for (const { title, body } of blocks) {
	    const t = title || "";
	    if (/(예상|예측|가능|병명|감별)/i.test(t)) {
	      put("predictedDiagnosis", body); continue;
	    }
	    if (/(정의|개요|원인|특징|증상)/i.test(t)) {         // "주요 원인" 포함
	      put("diagnosisDefinition", body); continue;
	    }
	    if (/(추천\s*진료과|진료과|방문\s*진료)/i.test(t)) {
	      put("recommendedDepartment", body); continue;
	    }
	    if (/(예방|관리|대처|자가\s*관리|응급)/i.test(t)) {
	      put("preventionManagement", body); continue;
	    }
	    if (/(생활|주의|추가|경고|TIP|메모)/i.test(t)) {
	      put("additionalInfo", body); continue;
	    }
	    // 못 맞춘 제목은 추가정보로 모음
	    put("additionalInfo", (title ? `${title}\n` : "") + body);
	  }

	  // 4) 그래도 전부 비어 있으면 전체를 예측 진단에 저장(최후의 폴백)
	  if (!Object.values(out).some(v => v)) out.predictedDiagnosis = response;

	  return out;
	}

	// 회원 조회된 경우에만 저장
	async function saveDiagnosisIfNeeded(symptomsText, chatResult) {
		if (!currentPatientId) return; // ✅ 핵심: 조회 안 했으면 저장 안 함

		const p = extractDiagnosisParts(chatResult);
		const payload = {
			patientId: currentPatientId,
			symptoms: symptomsText,
			predictedDiagnosis: p.predictedDiagnosis || "",
			diagnosisDefinition: p.diagnosisDefinition || "",
			recommendedDepartment: p.recommendedDepartment || "",
			preventionManagement: p.preventionManagement || "",
			additionalInfo: p.additionalInfo || ""
		};

		const res = await fetch(SAVE_URL, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(payload)
		});
		const text = await res.text();

		if (!res.ok) { console.error("SAVE_FAIL", res.status, text); return; }

		let saved = null; try { saved = JSON.parse(text); } catch { }
		prependHistoryRow(saved || { ...payload, chatDate: new Date().toISOString() });
	}

	function sendMessage() {
		const message = input.value.trim();
		if (!message) return;

		// 사용자 메시지 출력
		const userMsg = document.createElement("div");
		userMsg.classList.add("message", "user");
		userMsg.textContent = message;
		chat.appendChild(userMsg);
		chat.scrollTop = chat.scrollHeight;

		input.value = "";

		// 로딩 메시지
		const loadingMsg = document.createElement("div");
		loadingMsg.classList.add("message", "bot");
		loadingMsg.textContent = "답변 생성 중...";
		chat.appendChild(loadingMsg);

		fetch(API_CHAT, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ message })
		})
			.then((r) => r.json())
			.then(async (data) => {
				loadingMsg.remove();
				if (data.response) { showBotAnswer(data.response); }
				else { addMessage("응답이 없습니다.", "bot"); }

				// ✅ 회원 조회가 된 경우에만 DB 저장
				try { await saveDiagnosisIfNeeded(message, data); } catch (e) { console.warn(e); }
			})
			.catch((err) => {
				loadingMsg.remove();
				addMessage("서버와 통신 중 오류가 발생했습니다.", "bot");
				console.error(err);
			});
	}

	/* =========================
	   햄버거 메뉴
	========================= */
	const menuToggle = document.getElementById("menuToggle");
	const sideMenu = document.getElementById("sideMenu");
	const menuOverlay = document.getElementById("menuOverlay");

	function setMenuHiddenPosition() {
		const menuWidth = sideMenu?.offsetWidth || 240;
		if (sideMenu) sideMenu.style.left = `-${menuWidth + 10}px`;
	}
	setMenuHiddenPosition();

	menuToggle?.addEventListener("click", () => {
		sideMenu?.classList.add("open");
		if (sideMenu) sideMenu.style.left = "0";
		menuOverlay?.classList.add("show");
	});

	menuOverlay?.addEventListener("click", () => {
		setMenuHiddenPosition();
		sideMenu?.classList.remove("open");
		menuOverlay?.classList.remove("show");
	});

	document.querySelectorAll("#sideMenu a").forEach((link) => {
		link.addEventListener("click", () => {
			setMenuHiddenPosition();
			sideMenu?.classList.remove("open");
			menuOverlay?.classList.remove("show");
		});
	});

	/* =========================
	   글씨 크기
	========================= */
	let currentFontSize = 17;
	const minFontSize = 13, maxFontSize = 32;
	function setMsgFontSize(px) { document.documentElement.style.setProperty("--msg-font-size", px + "px"); }
	document.getElementById("fontIncrease")?.addEventListener("click", () => { if (currentFontSize < maxFontSize) { currentFontSize += 2; setMsgFontSize(currentFontSize); } });
	document.getElementById("fontDecrease")?.addEventListener("click", () => { if (currentFontSize > minFontSize) { currentFontSize -= 2; setMsgFontSize(currentFontSize); } });
	setMsgFontSize(currentFontSize);

	/* =========================
	   다크 모드
	========================= */
	const darkModeBtn = document.getElementById("darkModeBtn");
	const body = document.body;
	if (localStorage.getItem("darkMode") === "on") {
		body.classList.add("dark");
		if (darkModeBtn) darkModeBtn.textContent = "☀️";
	}
	darkModeBtn?.addEventListener("click", function() {
		if (body.classList.toggle("dark")) {
			darkModeBtn.textContent = "☀️"; localStorage.setItem("darkMode", "on");
		} else {
			darkModeBtn.textContent = "🌙"; localStorage.setItem("darkMode", "off");
		}
	});

	/* =========================
	   음성 입력
	========================= */
	const micBtn = document.querySelector(".mic-btn");
	let recognizing = false;
	let recognition;
	let silenceTimer = null;
	let originMicHTML = micBtn?.innerHTML;

	const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
	if (SpeechRecognition && micBtn) {
		recognition = new SpeechRecognition();
		recognition.lang = "ko-KR";
		recognition.interimResults = false;
		recognition.continuous = true;

		micBtn.addEventListener("click", () => { recognizing ? stopListening() : startListening(); });

		function startListening() {
			recognition.start(); micBtn.innerHTML = '<i class="fa-solid fa-circle-dot"></i>';
			micBtn.classList.add("active"); recognizing = true;
		}
		function stopListening() {
			recognition.stop(); micBtn.innerHTML = originMicHTML;
			micBtn.classList.remove("active"); recognizing = false; clearTimeout(silenceTimer);
		}

		recognition.onresult = (event) => {
			let text = "";
			for (let i = event.resultIndex; i < event.results.length; ++i) text += event.results[i][0].transcript;
			input.value = text;
			clearTimeout(silenceTimer);
			silenceTimer = setTimeout(() => { stopListening(); setTimeout(() => sendBtn?.click(), 100); }, 1500);
		};
		recognition.onerror = (e) => { alert("음성 인식 오류: " + e.error); stopListening(); };
		recognition.onend = () => { stopListening(); };
	} else if (micBtn) {
		micBtn.disabled = true;
		micBtn.title = "이 브라우저는 음성 인식을 지원하지 않습니다.";
	}
});
