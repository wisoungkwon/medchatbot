package com.medbot.controller;

import com.medbot.domain.Patient;
import com.medbot.domain.DiagnosisHistory;
import com.medbot.repository.PatientRepository;
import com.medbot.repository.DiagnosisHistoryRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/patient")
public class PatientController {

	private final PatientRepository patientRepository;
	private final DiagnosisHistoryRepository diagnosisHistoryRepository;

	public PatientController(PatientRepository patientRepository,
			DiagnosisHistoryRepository diagnosisHistoryRepository) {
		this.patientRepository = patientRepository;
		this.diagnosisHistoryRepository = diagnosisHistoryRepository;
	}

	@GetMapping("/{id}")
	public ResponseEntity<?> getPatientWithHistory(@PathVariable String id) {
		return patientRepository.findById(id).map(patient -> {
			List<DiagnosisHistory> historyList = diagnosisHistoryRepository.findByPatientIdOrderByChatDateDesc(id);
			return ResponseEntity.ok(new PatientWithHistoryResponse(patient.getId(), patient.getAge(),
					patient.getGender(), patient.getConditions(), historyList));
		}).orElse(ResponseEntity.notFound().build());
	}

	// 응답 DTO
	public record PatientWithHistoryResponse(String id, Integer age, String gender, String conditions,
			List<DiagnosisHistory> history) {
	}

	record SignupRequest(String id, Integer age, String gender, String conditions) {
	}

	@PostMapping("/register")
	public ResponseEntity<?> register(@RequestBody SignupRequest req) {
		if (req.id() == null || req.id().isBlank())
			return ResponseEntity.badRequest().body("id는 필수입니다.");
		if (req.age() == null)
			return ResponseEntity.badRequest().body("age는 필수입니다.");
		if (req.gender() == null || req.gender().isBlank())
			return ResponseEntity.badRequest().body("gender는 필수입니다.");

		String g = switch (req.gender().trim()) {
		case "남", "M", "male", "m" -> "m";
		case "여", "F", "female", "f" -> "f";
		default -> req.gender().trim().toLowerCase();
		};

		String cond = (req.conditions() == null || req.conditions().isBlank()) ? "없음" : req.conditions().trim(); // ⬅️
																													// 여기!

		if (patientRepository.existsById(req.id()))
			return ResponseEntity.status(409).body("이미 존재하는 아이디입니다.");

		Patient p = new Patient();
		p.setId(req.id().trim());
		p.setAge(req.age());
		p.setGender(g);
		p.setConditions(cond); // ⬅️ '없음' 저장
		patientRepository.save(p);

		return ResponseEntity.status(201).body("회원가입 완료");
	}

}
