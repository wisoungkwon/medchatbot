document.addEventListener("DOMContentLoaded", function() {
	/* =========================
	   환경/엔드포인트
	========================== */
	/*
	// ⭐ 수정: 안전한 API_CHAT 자동결정 + 전역 오버라이드 허용(window.API_CHAT)
	const DEFAULT_API_CHAT = (() => {
	  const isLocal = location.hostname === "localhost" || location.hostname === "127.0.0.1";
	  if (isLocal) return "http://localhost:5050/ask_symptoms";
	  // 시연장 핫스팟 IP 등 커스텀을 전역에서 주입하면 그걸 우선
	  if (typeof window !== "undefined" && window.API_CHAT) return window.API_CHAT;
	  // 네트워크 환경에서 백엔드 리버스 프록시를 태운다면 상대경로도 가능
	  return "/ask_symptoms";
	})();
	const API_CHAT = DEFAULT_API_CHAT;
	*/
	const SAVE_URL = "/api/diagnosis-history";

	/* =========================
	   DOM 캐시
	========================== */
	const byId = (id) => document.getElementById(id);

	// 채팅
	const chat = byId("chat");
	const input = byId("userInput");
	const sendBtn = byId("sendBtn");

	// 프로필/히스토리
	const profileSection = byId("profileSection");
	const historySection = byId("historySection");
	const historyBody = byId("history-table-body");
	const historyEmpty = byId("history-empty");
	const historyCloseBtn = byId("historyCloseBtn");
	const toggleHistoryBtn = byId("toggleHistoryBtn");

	const elId = byId("patient-id");
	const elAge = byId("patient-age");
	const elGender = byId("patient-gender");
	const elCond = byId("patient-conditions");

	// 로그인/회원가입 모달
	const loginBtn = byId("loginBtn");
	const logoutBtn = byId("logoutBtn");
	const loginModal = byId("loginModal");
	const closeLogin = byId("closeLogin");
	const loginForm = byId("loginForm");

	const signupBtn = byId("signupBtn");
	const signupModal = byId("signupModal");
	const closeSignup = byId("closeSignup");
	const signupForm = byId("signupForm");

	// 메뉴
	const menuToggle = byId("menuToggle");
	const sideMenu = byId("sideMenu");
	const menuOverlay = byId("menuOverlay");

	// 글씨/다크모드
	const darkModeBtn = byId("darkModeBtn");
	const body = document.body;

	/* =========================
	   상태
	========================== */
	let currentPatientId = null;
	let isWaitingForMoreInfo = false;
	let originalSymptom = "";

	let cachedHistory = null;
	let historyLoadedOnce = false;
	let isComposing = false; // ⭐ 수정: 한글 IME 조합상태 플래그

	/* =========================
	   유틸
	========================== */
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
		} catch {
			return dt ?? "";
		}
	}
	function show(el) {
		if (el) el.style.display = "block";
	}
	function hide(el) {
		if (el) el.style.display = "none";
	}

	function clearChatUI() {
		if (!chat) return;
		chat.innerHTML = '<div class="message bot">안녕하세요! 증상을 입력해 주세요.</div>';
	}
	function clearHistoryUI() {
		if (historyBody) historyBody.innerHTML = "";
		if (historyEmpty) historyEmpty.style.display = "none";
		hide(historySection);
		if (toggleHistoryBtn) {
			toggleHistoryBtn.setAttribute("aria-expanded", "false");
			toggleHistoryBtn.textContent = "확장";
		}
	}

	/* =========================
	   프로필/히스토리 렌더
	========================== */
	function renderPatientProfile(data) {
		if (!data) return;
		if (elId) elId.textContent = data.id ?? "";
		if (elAge) elAge.textContent = data.age ?? "";
		if (elGender)
			elGender.textContent =
				data.gender === "m" ? "남자" : data.gender === "f" ? "여자" : data.gender ?? "";
		if (elCond) elCond.textContent = !data.conditions || data.conditions.trim() === "" ? "없음" : data.conditions;
		show(profileSection);
	}

	function renderHistory(list = []) {
		if (!historyBody) return;
		historyBody.innerHTML = "";
		if (!list || list.length === 0) {
			show(historySection);
			show(historyEmpty);
			return;
		}
		hide(historyEmpty);

		// ⭐ 수정: chatDate 내림차순 정렬 보장
		list
			.slice()
			.sort((a, b) => new Date(b.chatDate || 0) - new Date(a.chatDate || 0))
			.forEach((r) => {
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

	function prependHistoryRow(r) {
		if (!historyBody) return;
		if (historyEmpty) historyEmpty.style.display = "none";
		const tr = document.createElement("tr");
		tr.innerHTML = `
      <td>${fmt(r.chatDate || new Date())}</td>
      <td>${escapeHtml(r.symptoms || "")}</td>
      <td>${escapeHtml(r.predictedDiagnosis || "")}</td>
      <td>${escapeHtml(r.recommendedDepartment || "")}</td>
      <td>${escapeHtml(r.additionalInfo || "")}</td>
    `;
		historyBody.firstChild
			? historyBody.insertBefore(tr, historyBody.firstChild)
			: historyBody.appendChild(tr);
	}

	/* =========================
	   히스토리 지연 로드
	========================== */
	async function fetchHistoryOnDemand(patientId) {
		try {
			const res = await fetch(`/patient/${encodeURIComponent(patientId)}/history`, { credentials: "include" });
			if (res.ok) {
				const list = await res.json();
				return Array.isArray(list) ? list : list?.history || [];
			}
		} catch (_) { }
		try {
			const res2 = await fetch(`/patient/${encodeURIComponent(patientId)}`, { credentials: "include" });
			if (res2.ok) {
				const data2 = await res2.json();
				return data2?.history || [];
			}
		} catch (_) { }
		return [];
	}
	async function ensureHistoryLoaded() {
		if (!currentPatientId) return [];
		if (historyLoadedOnce && Array.isArray(cachedHistory)) return cachedHistory;
		const list = await fetchHistoryOnDemand(currentPatientId);
		cachedHistory = list;
		historyLoadedOnce = true;
		return list;
	}

	/* =========================
	   프로필 불러오기
	========================== */
	async function loadMyProfile(id) {
		const url = id ? `/patient/${encodeURIComponent(id)}` : `/patient/me`;
		const res = await fetch(url, { credentials: "include" });
		if (!res.ok) throw new Error("프로필을 불러오지 못했습니다.");
		const data = await res.json();
		currentPatientId = data.id || id || null;

		renderPatientProfile(data);
		cachedHistory = Array.isArray(data.history) ? data.history : null;
		historyLoadedOnce = Array.isArray(cachedHistory);
		clearHistoryUI();
	}

	/* =========================
	   히스토리 토글
	========================== */
	toggleHistoryBtn?.addEventListener("click", async () => {
		if (!currentPatientId) return alert("로그인 후 이용해주세요.");
		const expanded = toggleHistoryBtn.getAttribute("aria-expanded") === "true";
		if (expanded) {
			hide(historySection);
			toggleHistoryBtn.setAttribute("aria-expanded", "false");
			toggleHistoryBtn.textContent = "확장";
			return;
		}
		let list = cachedHistory;
		if (!historyLoadedOnce) {
			toggleHistoryBtn.textContent = "로딩중...";
			list = await ensureHistoryLoaded();
		}
		renderHistory(list || []);
		toggleHistoryBtn.setAttribute("aria-expanded", "true");
		toggleHistoryBtn.textContent = "축소";
	});

	historyCloseBtn?.addEventListener("click", () => {
		hide(historySection);
		toggleHistoryBtn?.setAttribute("aria-expanded", "false");
		if (toggleHistoryBtn) toggleHistoryBtn.textContent = "확장";
	});

	/* =========================
	   모달 오픈/닫기 (중복 제거/정리)
	========================== */
	function resetSignupForm() {
		if (!signupForm) return;
		signupForm.reset();
		byId("signupId") && (byId("signupId").value = "");
		byId("signupPwd") && (byId("signupPwd").value = "");
		byId("signupPwdConfirm") && (byId("signupPwdConfirm").value = "");
		byId("signupAge") && (byId("signupAge").value = "");
		byId("signupCondition") && (byId("signupCondition").value = "");
		document.querySelectorAll("input[name='signupGender']").forEach((el) => (el.checked = false));
		const pwd = byId("signupPwd");
		const pwd2 = byId("signupPwdConfirm");
		const icon1 = byId("togglePwd");
		const icon2 = byId("togglePwdConfirm");
		if (pwd) pwd.type = "password";
		if (pwd2) pwd2.type = "password";
		[icon1, icon2].forEach((icon) => {
			if (icon && icon.classList.contains("fa")) {
				icon.classList.add("fa-eye");
				icon.classList.remove("fa-eye-slash");
			}
		});
		const pwMsg = byId("pwMatchMsg");
		if (pwMsg) {
			pwMsg.textContent = "";
			pwMsg.style.display = "none";
			pwMsg.classList.remove("ok", "bad");
		}
		byId("signupId")?.focus();
	}

	function resetLoginForm() {
		if (!loginForm) return;
		loginForm.reset();
		byId("loginId") && (byId("loginId").value = "");
		const lpw = byId("loginPassword");
		const icon = byId("pwToggleLogin");
		if (lpw) lpw.type = "password";
		if (icon && icon.classList.contains("fa")) {
			icon.classList.add("fa-eye");
			icon.classList.remove("fa-eye-slash");
		}
		byId("loginId")?.focus();
	}

	signupBtn?.addEventListener("click", () => {
		if (!signupModal) return;
		resetSignupForm();
		signupModal.style.display = "block";
	});
	closeSignup?.addEventListener("click", () => {
		if (!signupModal) return;
		signupModal.style.display = "none";
		resetSignupForm();
	});

	loginBtn?.addEventListener("click", () => {
		if (!loginModal) return;
		resetLoginForm();
		loginModal.style.display = "block";
	});
	closeLogin?.addEventListener("click", () => {
		if (!loginModal) return;
		loginModal.style.display = "none";
		resetLoginForm();
	});

	window.addEventListener("click", (e) => {
		if (e.target === signupModal) {
			signupModal.style.display = "none";
			resetSignupForm();
		}
		if (e.target === loginModal) {
			loginModal.style.display = "none";
			resetLoginForm();
		}
	});

	/* =========================
	   비밀번호 표시/숨김 + 정책
	========================== */
	function togglePassword(inputEl, iconEl) {
		if (!inputEl || !iconEl) return;
		iconEl.addEventListener("click", () => {
			const toText = inputEl.type === "password";
			inputEl.type = toText ? "text" : "password";
			if (iconEl.classList.contains("fa")) {
				iconEl.classList.toggle("fa-eye");
				iconEl.classList.toggle("fa-eye-slash");
			}
		});
	}
	togglePassword(byId("signupPwd"), byId("togglePwd"));
	togglePassword(byId("signupPwdConfirm"), byId("togglePwdConfirm"));
	togglePassword(byId("loginPassword"), byId("pwToggleLogin"));

	const pwMsg = byId("pwMatchMsg");
	const passwordRegex =
		/^(?=.*[A-Za-z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,20}$/;
	function updatePwFeedback() {
		const p1 = byId("signupPwd")?.value || "";
		const p2 = byId("signupPwdConfirm")?.value || "";
		pwMsg?.classList.remove("ok", "bad");
		if (pwMsg) pwMsg.style.display = "none";
		if (!p1 && !p2) return;
		if (!passwordRegex.test(p1)) {
			if (pwMsg) {
				pwMsg.textContent = "영문, 숫자, 특수문자를 모두 포함한 8~20자";
				pwMsg.classList.add("bad");
				pwMsg.style.display = "block";
			}
			return;
		}
		if (p2 && p1 !== p2) {
			if (pwMsg) {
				pwMsg.textContent = "비밀번호가 일치하지 않습니다.";
				pwMsg.classList.add("bad");
				pwMsg.style.display = "block";
			}
			return;
		}
		if (p2 && p1 === p2) {
			if (pwMsg) {
				pwMsg.textContent = "비밀번호가 일치합니다.";
				pwMsg.classList.add("ok");
				pwMsg.style.display = "block";
			}
		}
	}
	byId("signupPwd")?.addEventListener("input", updatePwFeedback);
	byId("signupPwdConfirm")?.addEventListener("input", updatePwFeedback);

	/* =========================
	   회원가입/로그인/로그아웃
	========================== */
	signupForm?.addEventListener("submit", async (e) => {
		e.preventDefault();
		const id = byId("signupId")?.value?.trim();
		const age = Number(byId("signupAge")?.value);
		const genderKo = document.querySelector("input[name='signupGender']:checked")?.value;
		const condRaw = byId("signupCondition")?.value?.trim() || "";
		const pwd = byId("signupPwd")?.value || "";
		const pwd2 = byId("signupPwdConfirm")?.value || "";

		if (!id || !age || !genderKo || !pwd || !pwd2) return alert("필수 항목을 모두 입력해주세요.");
		if (!passwordRegex.test(pwd)) return alert("비밀번호는 영문/숫자/특수문자 포함 8~20자");
		if (pwd !== pwd2) return alert("비밀번호가 일치하지 않습니다."); // 🛠️ 오타? → 아래 줄로 교체

		const gender = genderKo === "남" ? "m" : "f";
		const conditions = condRaw === "" ? "없음" : condRaw;

		try {
			const res = await fetch("/patient/register", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				credentials: "include",
				body: JSON.stringify({ id, age, gender, conditions, password: pwd })
			});
			const txt = await res.text();
			if (!res.ok) throw new Error(txt || "회원가입 실패");
			alert(txt || "회원가입이 완료되었습니다!");
			resetSignupForm();
			signupModal.style.display = "none";
		} catch (err) {
			alert(err.message || "오류가 발생했습니다.");
		}
	});

	async function doLogin(id, password) {
		const res = await fetch("/patient/login", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			credentials: "include",
			body: JSON.stringify({ id, password })
		});
		const text = await res.text();
		
		alert("로그인 되었습니다!");
		
		if (!res.ok) throw new Error(text || "로그인 실패");
		resetLoginForm?.();
		if (loginModal) loginModal.style.display = "none";
		if (loginBtn) loginBtn.style.display = "none";
		if (signupBtn) signupBtn.style.display = "none";
		if (logoutBtn) logoutBtn.style.display = "list-item";
		return id;
		
	}

	loginForm?.addEventListener("submit", async (e) => {
		e.preventDefault();
		const id = byId("loginId")?.value?.trim();
		const pw = byId("loginPassword")?.value || "";
		if (!id || !pw) return alert("아이디/비밀번호를 입력하세요.");
		try {
			const loggedId = await doLogin(id, pw);
			await loadMyProfile(loggedId);
		} catch (err) {
			alert(err.message || "로그인 실패");
		}
	});

	logoutBtn?.addEventListener("click", async () => {
		try {
			const res = await fetch("/patient/logout", { method: "POST", credentials: "include" });
			const text = await res.text();
			if (!res.ok) throw new Error(text || "로그아웃 실패");
			if (logoutBtn) logoutBtn.style.display = "none";
			if (loginBtn) loginBtn.style.display = "list-item";
			if (signupBtn) signupBtn.style.display = "list-item";

			currentPatientId = null;
			hide(profileSection);
			clearHistoryUI();
			clearChatUI();
			alert("로그아웃 되었습니다.");
			
			location.reload(true); 
			
		} catch (e) {
			alert(e.message || "로그아웃 실패");
		}
	});

	/* =========================
	   전송용 환자 기본정보 (중복 제거 버전)
	========================== */
	function getPatientBasicInfoForSend() {
		const age = elAge?.textContent?.trim() || null;
		const genderText = (elGender?.textContent || "").trim();
		let gender = null;
		if (genderText === "남자") gender = "m";
		else if (genderText === "여자") gender = "f";
		else if (genderText) gender = genderText;
		const conditions = elCond?.textContent?.trim() || "";
		return { age, gender, conditions };
	}

	/* =========================
	   채팅 렌더
	========================== */
	function addMessage(text, sender) {
		const msg = document.createElement("div");
		msg.classList.add("message", sender);
		msg.textContent = text;
		chat.appendChild(msg);
		chat.scrollTop = chat.scrollHeight;
		return msg;
	}

	async function showBotAnswer(answer) {
		const msg = document.createElement("div");
		msg.classList.add("message", "bot", "section");
		if (typeof marked !== "undefined") {
			msg.innerHTML = marked.parse(answer);
		} else {
			// 폴백: plain text
			msg.textContent = answer;
		}
		chat.appendChild(msg);
		chat.scrollTop = chat.scrollHeight;
	}

	async function saveDiagnosisIfNeeded(symptomsText, chatResult) {
		if (!currentPatientId) return;
		const p = chatResult?.answer;
		if (!p) return;

		const payload = {
			patientId: currentPatientId,
			symptoms: symptomsText,
			predictedDiagnosis: p.predictedDiagnosis || "",
			diagnosisDefinition: p.diagnosisDefinition || "",
			recommendedDepartment: p.recommendedDepartment || "",
			preventionManagement: p.preventionManagement || "",
			additionalInfo: p.additionalInfo || "",
			medicine: p.medicine || ""
		};

		try {
			const res = await fetch(SAVE_URL, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				credentials: "include",
				body: JSON.stringify(payload)
			});
			const text = await res.text();
			if (!res.ok) {
				if (res.status === 401) alert("로그인이 필요합니다.");
				else if (res.status === 403) alert("본인 계정의 기록만 저장할 수 있습니다.");
				console.error("SAVE_FAIL", res.status, text);
				return;
			}
			let saved = null;
			try {
				saved = JSON.parse(text);
			} catch { }
			const row = saved || { ...payload, chatDate: new Date().toISOString() };
			cachedHistory = Array.isArray(cachedHistory) ? [row, ...cachedHistory] : [row];
			historyLoadedOnce = true;
			if (historySection && historySection.style.display !== "none") {
				prependHistoryRow(row);
			}
		} catch (e) {
			console.warn("DB 저장 실패:", e);
		}
	}

	/* =========================
	   메시지 전송
	========================== */
	input?.addEventListener("compositionstart", () => (isComposing = true)); // ⭐ 한글 조합 시작
	input?.addEventListener("compositionend", () => (isComposing = false));  // ⭐ 한글 조합 종료

	input?.addEventListener("keydown", (e) => {
		if (e.key === "Enter" && !e.shiftKey && !isComposing) {
			e.preventDefault();
			sendMessage();
		}
	});
	sendBtn?.addEventListener("click", sendMessage);

	async function sendMessage() {
		const message = input.value.trim();
		if (!message) return;

		// 전송 중 재클릭 방지
		if (sendBtn) sendBtn.disabled = true;

		const userMsg = document.createElement("div");
		userMsg.classList.add("message", "user");
		userMsg.textContent = message;
		chat.appendChild(userMsg);
		chat.scrollTop = chat.scrollHeight;
		input.value = "";

		const loadingMsg = document.createElement("div");
		loadingMsg.classList.add("message", "bot");
		loadingMsg.textContent = "답변 생성 중...";
		chat.appendChild(loadingMsg);

		let requestBody = {};
		let symptomsToSave = "";

		if (isWaitingForMoreInfo) {
			symptomsToSave = (originalSymptom + " " + message).trim();
			requestBody.symptom = originalSymptom;
			requestBody.additional_symptoms = message;
			isWaitingForMoreInfo = false;
		} else {
			symptomsToSave = message;
			originalSymptom = message;
			requestBody.symptom = message;
		}

		requestBody.patient = getPatientBasicInfoForSend();

		try {
			const r = await fetch(API_CHAT, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(requestBody)
			});
			const data = await r.json();

			loadingMsg.remove();

			if (data.status === "needs_more_info") {
				isWaitingForMoreInfo = true;
				await showBotAnswer(data.message || "추가 증상을 더 알려주세요.");
			} else if (data.answer) {
				if (typeof data.answer === "object" && data.answer.rawResponse) {
					await showBotAnswer(data.answer.rawResponse);
					await saveDiagnosisIfNeeded(symptomsToSave, data);
				} else {
					await showBotAnswer(String(data.answer));
				}
				originalSymptom = "";
			} else {
				addMessage("응답이 없습니다.", "bot");
			}
		} catch (err) {
			loadingMsg.remove();
			addMessage("서버와 통신 중 오류가 발생했습니다.", "bot");
			console.error(err);
		} finally {
			if (sendBtn) sendBtn.disabled = false;
		}
	}

	/* =========================
	   메뉴(햄버거)
	========================== */
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
	   음성 입력 → 자동 전송
	========================== */
	(function setupAutoSTT() {
		const micBtn = document.querySelector(".mic-btn");
		if (!micBtn || !input || !sendBtn) return;

		const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
		if (!SR) {
			micBtn.addEventListener("click", () => {
				alert("이 브라우저는 음성 인식을 지원하지 않습니다.\nChrome에서 HTTPS(또는 localhost)로 접속해 주세요.");
			});
			return;
		}
		const recognition = new SR();
		recognition.lang = "ko-KR";
		recognition.interimResults = true;
		recognition.continuous = false;

		let recognizing = false;
		let baseValue = "";
		let finalTranscript = "";

		function setBusy(busy) {
			recognizing = busy;
			micBtn.classList.toggle("recording", busy);
			micBtn.disabled = busy;
			micBtn.setAttribute("aria-label", busy ? "음성 입력 중지" : "음성 입력 시작");
			input.placeholder = busy ? "듣는 중..." : "메시지를 입력하세요.";
		}

		micBtn.addEventListener("click", () => {
			if (recognizing) {
				recognition.stop();
				return;
			}
			try {
				baseValue = input.value ? input.value.trim() + " " : "";
				finalTranscript = "";
				recognition.start();
			} catch (e) {
				console.warn("recognition.start() 실패:", e);
				alert("마이크 권한이 필요합니다. 브라우저 설정에서 권한을 허용해 주세요.");
			}
		});

		recognition.onstart = () => setBusy(true);
		recognition.onerror = (e) => {
			console.warn("STT error:", e.error || e);
			if (e.error === "not-allowed" || e.error === "permission-denied") {
				alert("마이크 사용이 거부되었습니다. 브라우저 설정에서 권한을 허용해 주세요.");
			}
		};
		recognition.onresult = (e) => {
			let interim = "";
			for (let i = e.resultIndex; i < e.results.length; i++) {
				const r = e.results[i];
				if (r.isFinal) finalTranscript += r[0].transcript;
				else interim += r[0].transcript;
			}
			input.value = (baseValue + finalTranscript).trimStart();
			input.focus();
			const pos = input.value.length;
			input.setSelectionRange(pos, pos);
		};
		recognition.onend = () => {
			setBusy(false);
			input.value = (baseValue + finalTranscript).trim();
			if (input.value) sendBtn.click();
		};
	})();

	/* =========================
	   글씨 크기/다크모드
	========================== */
	let currentFontSize = 17;
	const minFontSize = 13,
		maxFontSize = 32;
	function setMsgFontSize(px) {
		document.documentElement.style.setProperty("--msg-font-size", px + "px");
	}
	byId("fontIncrease")?.addEventListener("click", () => {
		if (currentFontSize < maxFontSize) {
			currentFontSize += 2;
			setMsgFontSize(currentFontSize);
		}
	});
	byId("fontDecrease")?.addEventListener("click", () => {
		if (currentFontSize > minFontSize) {
			currentFontSize -= 2;
			setMsgFontSize(currentFontSize);
		}
	});
	setMsgFontSize(currentFontSize);

	if (localStorage.getItem("darkMode") === "on") {
		body.classList.add("dark");
		if (darkModeBtn) darkModeBtn.textContent = "☀️";
	}
	darkModeBtn?.addEventListener("click", function() {
		if (body.classList.toggle("dark")) {
			if (darkModeBtn) darkModeBtn.textContent = "☀️";
			localStorage.setItem("darkMode", "on");
		} else {
			if (darkModeBtn) darkModeBtn.textContent = "🌙";
			localStorage.setItem("darkMode", "off");
		}
	});
});
