package com.medbot.controller;

import com.medbot.domain.DiagnosisHistory;
import com.medbot.repository.DiagnosisHistoryRepository;
import com.medbot.repository.PatientRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.*;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
public class DiagnosisHistoryController {

    private final DiagnosisHistoryRepository historyRepo;

    @Autowired(required = false)
    private PatientRepository patientRepo;

    public DiagnosisHistoryController(DiagnosisHistoryRepository historyRepo) {
        this.historyRepo = historyRepo;
    }

    @PostMapping("/diagnosis-history")
    public ResponseEntity<?> save(@RequestBody DiagnosisHistory body) {
        if (body.getPatientId() == null || body.getPatientId().isBlank()) {
            return ResponseEntity.badRequest().body("patient_id required");
        }
        if (patientRepo != null && !patientRepo.existsById(body.getPatientId())) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body("Patient not found. Save blocked.");
        }

        // ✅ onCreate()에서 chatDate가 자동 세팅됨
        DiagnosisHistory saved = historyRepo.save(body);
        return ResponseEntity.ok(saved); // 바로 chatDate 포함돼서 반환됨
    }

    @GetMapping("/patients/{patientId}/diagnosis-history")
    public Page<DiagnosisHistory> listByPatient(
            @PathVariable String patientId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size
    ) {
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "chatDate"));
        return historyRepo.findAllByPatientId(patientId, pageable);
    }
}
