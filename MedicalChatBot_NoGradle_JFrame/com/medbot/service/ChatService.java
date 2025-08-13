package com.medbot.service;

import com.medbot.db.PatientRepository;
import com.medbot.model.DiagnosisHistory;
import com.medbot.model.Patient;
import org.json.simple.JSONObject;
import org.json.simple.parser.JSONParser;
import org.json.simple.parser.ParseException;

import java.io.*;
import java.net.HttpURLConnection;
import java.net.URL;
import java.sql.SQLException;
import java.util.List;

public class ChatService {

    // Python Flask 서버 주소
    private static final String SERVER_URL = "http://localhost:5050/chat";

    public static String sendToServer(String message, Patient patient) throws IOException, SQLException {
        // AI 모델에 전달할 프롬프트 준비
        StringBuilder fullPrompt = new StringBuilder();

        if (patient != null) {
            // 1.환자 기본 정보 추가
            fullPrompt.append("나이: ").append(patient.age)
                      .append(", 성별: ").append(patient.gender)
                      .append(", 기저질환: ").append(patient.conditions)
                      .append("인 환자입니다. ");

            // 2.과거 진단 기록 추가
            List<DiagnosisHistory> history = PatientRepository.findDiagnosisHistoryByPatientId(patient.id);
            if (!history.isEmpty()) {
                fullPrompt.append("과거 진단 기록은 다음과 같습니다. ");
                for (DiagnosisHistory h : history) {
                    fullPrompt.append("이전에 ").append(h.getSymptoms()).append(" 증상으로 ")
                              .append(h.getDiagnosisDefinition()).append(" 진단을 받았습니다. ");
                }
            }
        } else {
            // 1-1.환자 정보가 없을 때 기본 메시지
            fullPrompt.append("환자 정보는 없습니다. ");
        }

        // 3. 현재 증상
        fullPrompt.append("이번에 챗봇에게 입력한 증상은 \"").append(message).append("\"입니다.");

        System.out.println("AI 모델에 전달할 최종 프롬프트: " + fullPrompt);

        // ------------------------------
        // Python Flask 서버로 HTTP 요청
        // ------------------------------
        URL url = new URL(SERVER_URL);
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();

        conn.setRequestMethod("POST");
        conn.setRequestProperty("Content-Type", "application/json; charset=UTF-8");
        conn.setDoOutput(true);

        // 요청 JSON 생성
        JSONObject json = new JSONObject();
        json.put("message", fullPrompt.toString());

        try (OutputStream os = conn.getOutputStream()) {
            byte[] input = json.toString().getBytes("UTF-8");
            os.write(input);
        }

        // 응답 읽기
        StringBuilder response = new StringBuilder();
        try (BufferedReader br = new BufferedReader(
                new InputStreamReader(conn.getInputStream(), "UTF-8"))) {
            String line;
            while ((line = br.readLine()) != null) {
                response.append(line.trim());
            }
        }

        // JSON 파싱
        JSONParser parser = new JSONParser();
        try {
            JSONObject jsonResponse = (JSONObject) parser.parse(response.toString());
            return (String) jsonResponse.get("response");
        } catch (ParseException e) {
            e.printStackTrace();
            return "⚠️ 서버 응답을 파싱할 수 없습니다.";
        }
    }
}
