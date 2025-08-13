package com.medbot.ui;

import com.medbot.model.Patient;
import com.medbot.db.PatientRepository;
import com.medbot.service.ChatService;

import javax.swing.*;
import java.awt.*;
import java.awt.event.ActionEvent;
import java.sql.SQLException;
import java.util.HashMap;
import java.util.Map;

public class ChatBotUI extends JFrame {
	private JTextArea chatArea;
	private JTextField inputField;
	private JTextField patientIdField;
	private Patient currentPatient;

	public void createAndShowGUI() {
		JFrame frame = new JFrame("의료 챗봇 MedBot");
		chatArea = new JTextArea(30, 70);
		chatArea.setEditable(false);
		chatArea.setLineWrap(true);
		chatArea.setWrapStyleWord(true);

		inputField = new JTextField(40);
		inputField.enableInputMethods(true);

		patientIdField = new JTextField(5);

		// 상단 패널
		JPanel topPanel = new JPanel();
		topPanel.add(new JLabel("환자 ID:"));
		topPanel.add(patientIdField);
		JButton loadButton = new JButton("불러오기");
		topPanel.add(loadButton);
		JButton insertButton = new JButton("회원가입");
		topPanel.add(insertButton);

		// 하단 패널
		JPanel bottomPanel = new JPanel();
		bottomPanel.add(inputField);
		JButton sendButton = new JButton("전송");
		bottomPanel.add(sendButton);

		frame.setLayout(new BorderLayout());
		frame.add(topPanel, BorderLayout.NORTH);
		frame.add(new JScrollPane(chatArea), BorderLayout.CENTER);
		frame.add(bottomPanel, BorderLayout.SOUTH);
		frame.pack();
		frame.setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);
		frame.setVisible(true);

		frame.addWindowListener(new java.awt.event.WindowAdapter() {
			@Override
			public void windowOpened(java.awt.event.WindowEvent e) {
				SwingUtilities.invokeLater(() -> inputField.requestFocusInWindow());
			}
		});

		frame.setVisible(true);

		// 환자 정보 불러오기
		loadButton.addActionListener((ActionEvent e) -> {
			String patientIdText = patientIdField.getText();
			if (patientIdText.trim().isEmpty()) {
				chatArea.append("❌ 환자 ID를 입력해주세요.\n");
				return;
			}
			currentPatient = PatientRepository.findById(patientIdText);
			if (currentPatient != null) {
				chatArea.append("✅ 환자 정보: " + currentPatient + "\n");
			} else {
				chatArea.append("❌ 환자 정보를 찾을 수 없습니다.\n");
			}
		});

		// 회원가입
		insertButton.addActionListener((ActionEvent e) -> {
			JoinDialog joinDialog = new JoinDialog(frame, this);
			joinDialog.setVisible(true);
		});

		// 메시지 전송
		sendButton.addActionListener((ActionEvent e) -> {
			String userInput = inputField.getText().trim();
			if (userInput.isEmpty()) {
				return;
			}
			chatArea.append("🙋 사용자: " + userInput + "\n");
			inputField.setText("");

			// currentPatient가 null이어도 서버 호출은 함
			new Thread(() -> {
				try {
					String reply = ChatService.sendToServer(userInput, currentPatient); // 내부에서 null 처리 필요
					String formattedReply = formatBotReply(reply);

					SwingUtilities.invokeLater(() -> {
						chatArea.append("🩺 MedBot\n" + formattedReply + "\n");
					});

					// currentPatient 있을 때만 저장, reply를 분리해서 저장
					if (currentPatient != null) {
						try {
							Map<String, String> parsedSections = parseReplyIntoSections(reply);
							PatientRepository.saveChatResult(currentPatient.getId(), userInput,
									parsedSections.get("predictedDiagnosis"), parsedSections.get("diagnosisDefinition"),
									parsedSections.get("recommendedDepartment"),
									parsedSections.get("preventionManagement"), parsedSections.get("additionalInfo"));
						} catch (SQLException ex) {
							SwingUtilities.invokeLater(() -> {
								chatArea.append("❌ 결과 저장 오류\n");
							});
							ex.printStackTrace();
						}
					}
				} catch (Exception ex) {
					SwingUtilities.invokeLater(() -> {
						chatArea.append("❌ 서버 통신 오류\n");
					});
					ex.printStackTrace();
				}
			}).start();
		});

		inputField.addActionListener(e -> {
			sendButton.doClick();
		});
	}

	// UI 출력용: 포맷팅해서 예쁘게 보여줌
	private String formatBotReply(String reply) {
		if (reply == null)
			return "";

		// 1. "MedBot:" 제거
		reply = reply.replaceFirst("(?i)MedBot[:：]?", "").trim();

		// 2. 줄 단위로 나누어 포맷 적용
		String[] lines = reply.split("\n");
		StringBuilder formatted = new StringBuilder();

		for (String line : lines) {
			line = line.trim();

			if (line.startsWith("1.")) {
				formatted.append("[1. 예상되는 병명]").append("\n");
				line = line.replaceFirst("1\\.\\s*", "").trim();
				formatted.append(line).append("\n");
			} else if (line.startsWith("2.")) {
				formatted.append("[2. 병명 정의]").append("\n");
				line = line.replaceFirst("2\\.\\s*", "").trim();
				formatted.append(line).append("\n");
			} else if (line.startsWith("3.")) {
				formatted.append("[3. 추천 진료과]").append("\n");
				line = line.replaceFirst("3\\.\\s*", "").trim();
				formatted.append(line).append("\n");
			} else if (line.startsWith("4.")) {
				formatted.append("[4. 예방 및 관리 방법]").append("\n");
				line = line.replaceFirst("4\\.\\s*", "").trim();
				formatted.append(line).append("\n");
			} else if (line.startsWith("5.")) {
				formatted.append("[5. 기타 필요한 정보]").append("\n");
				line = line.replaceFirst("5\\.\\s*", "").trim();
				formatted.append(line).append("\n");
			} else {
				formatted.append(line).append("\n");
			}
		}
		return formatted.toString().trim();
	}

	// DB 저장용: reply를 5가지 영역별로 분리
	private Map<String, String> parseReplyIntoSections(String reply) {
		Map<String, String> sections = new HashMap<>();
		sections.put("predictedDiagnosis", "");
		sections.put("diagnosisDefinition", "");
		sections.put("recommendedDepartment", "");
		sections.put("preventionManagement", "");
		sections.put("additionalInfo", "");

		String[] lines = reply.split("\n");
		String currentKey = null;

		for (String line : lines) {
			line = line.trim();

			if (line.startsWith("1.")) {
				currentKey = "predictedDiagnosis";
				line = line.replaceFirst("1\\.\\s*", "");
			} else if (line.startsWith("2.")) {
				currentKey = "diagnosisDefinition";
				line = line.replaceFirst("2\\.\\s*", "");
			} else if (line.startsWith("3.")) {
				currentKey = "recommendedDepartment";
				line = line.replaceFirst("3\\.\\s*", "");
			} else if (line.startsWith("4.")) {
				currentKey = "preventionManagement";
				line = line.replaceFirst("4\\.\\s*", "");
			} else if (line.startsWith("5.")) {
				currentKey = "additionalInfo";
				line = line.replaceFirst("5\\.\\s*", "");
			}

			if (currentKey != null) {
				String old = sections.get(currentKey);
				sections.put(currentKey, old + line + "\n");
			}
		}

		sections.replaceAll((k, v) -> v.trim());
		return sections;
	}

	// JoinDialog에서 호출할 메서드
	public void appendChatArea(String message) {
		chatArea.append(message);
	}
}
