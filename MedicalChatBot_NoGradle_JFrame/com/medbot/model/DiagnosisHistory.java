package com.medbot.model;

//PatientRepository.java
import java.util.List;
import java.sql.Timestamp;
import java.util.ArrayList;

//진단 기록을 담을 DTO(Data Transfer Object) 클래스
public class DiagnosisHistory {
    private String symptoms;
    private String predictedDiagnosis;       // 예상 병명
    private String diagnosisDefinition;      // 병명 정의
    private String recommendedDepartment;    // 추천 진료과
    private String preventionManagement;     // 예방 및 관리 방법
    private String additionalInfo;            // 기타 필요한 정보
    private Timestamp chatDate;

    public DiagnosisHistory(String symptoms, String predictedDiagnosis, String diagnosisDefinition,
                            String recommendedDepartment, String preventionManagement, String additionalInfo,
                            Timestamp chatDate) {
        this.symptoms = symptoms;
        this.predictedDiagnosis = predictedDiagnosis;
        this.diagnosisDefinition = diagnosisDefinition;
        this.recommendedDepartment = recommendedDepartment;
        this.preventionManagement = preventionManagement;
        this.additionalInfo = additionalInfo;
        this.chatDate = chatDate;
    }

    // Getters (필요시 추가)
    public String getSymptoms() { return symptoms; }
    public String getPredictedDiagnosis() { return predictedDiagnosis; }
    public String getDiagnosisDefinition() { return diagnosisDefinition; }
    public String getRecommendedDepartment() { return recommendedDepartment; }
    public String getPreventionManagement() { return preventionManagement; }
    public String getAdditionalInfo() { return additionalInfo; }
    public Timestamp getChatDate() { return chatDate; }

    @Override
    public String toString() {
        return "증상: " + symptoms + ", 예상 병명: " + predictedDiagnosis + ", 병명 정의: " + diagnosisDefinition
                + ", 추천 진료과: " + recommendedDepartment + ", 예방 및 관리: " + preventionManagement
                + ", 기타 정보: " + additionalInfo + ", 날짜: " + chatDate;
    }
}
