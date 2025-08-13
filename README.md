# 🩺 MedChatBot

**MedChatBot**은 환자의 증상, 기본정보, 과거 진단 내역을 바탕으로 AI가 진단 가이드를 제공하는 **Spring Boot + MySQL 기반 웹 애플리케이션**입니다.  
프론트엔드와 백엔드가 실시간으로 연결되며, LLM 응답을 파싱하여 데이터베이스에 저장합니다.

---

## 🚀 주요 기능

- **증상 입력 & 진단**
  - 사용자가 입력한 증상 + 환자 정보 + 과거 진단 기록을 종합하여 AI 진단 가이드 제공
- **과거 진단 조회**
  - 로그인한 회원의 과거 진단 기록 조회 가능
- **데이터 저장**
  - MySQL `diagnosis_history` 테이블에 5개 섹션으로 파싱하여 저장
- **다크 모드 지원**
  - UI 전체에 다크모드 적용 (일부 패널 포함)
- **회원 관리**
  - 회원가입 / 로그인 / 진단 기록 저장

---

## 🛠 기술 스택

| 영역 | 기술 |
|------|------|
| **Frontend** | HTML, CSS, JavaScript |
| **Backend** | Spring Boot (Java) |
| **Database** | MySQL |
| **AI/LLM** | OpenAI / SKT-AI 기반 LLM 모델 |
| **버전 관리** | Git, GitHub |

[![Java](https://img.shields.io/badge/Java-17-orange?logo=java)](https://www.oracle.com/java/)  
[![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3.1.4-brightgreen?logo=springboot)](https://spring.io/projects/spring-boot)  
[![MySQL](https://img.shields.io/badge/MySQL-8.0-blue?logo=mysql)](https://www.mysql.com/)  

---

## 📂 프로젝트 구조

```plaintext
medchatbot-main/
├── src/
│   ├── main/java/...    # Spring Boot 백엔드 코드
│   ├── main/resources/  # application.properties 등 설정
├── static/              # 프론트엔드 HTML, CSS, JS
├── pom.xml              # Maven 설정
└── README.md

