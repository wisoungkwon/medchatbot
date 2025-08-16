package com.member2.exception;

import java.io.File;
import java.util.Scanner;
import com.member2.controller.MemberDAO2;
import com.member2.domain.MemberVO2;

public class MainDisplay2 {
	private static final String MEMBER_FILE = "D:\\JAVA\\member2\\member.txt";
	private static final String PASS_FILE = "D:\\JAVA\\member2\\pass.txt";

	Scanner s = new Scanner(System.in);
	private MemberDAO2 dao = new MemberDAO2();
	private MemberVO2 currentMember;

	public void start() {
		if (!new File(MEMBER_FILE).exists() || !new File(PASS_FILE).exists()) {
			System.out.println("필수 파일이 존재하지 않습니다. 시스템을 종료합니다.");
			System.exit(0);
		}

		dao.loadMemberData();
		dao.loadPasswordData();

		String starStr = "*".repeat(55);
		System.out.println(starStr);
		System.out.println("\t\t\t로그인");
		System.out.println(starStr);

		int attempts = 0;

		while (true) {
			System.out.print("아이디를 입력하세요: ");
			String id = s.nextLine();

			MemberVO2 member = dao.findMemberByName(id);

			if (member == null) {
				System.out.println("일치하는 아이디가 없습니다.");
				continue;
			}

			System.out.print("비밀번호를 입력하세요: ");
			String pass = s.nextLine();
			String storedPass = dao.getPassword(id);

			if (!pass.equals(storedPass)) {
				attempts++;
				if (attempts >= 3) {
					System.out.println("로그인 횟수 초과. 프로그램을 종료합니다.");
					System.exit(0);
				}
				System.out.println("비밀번호가 틀렸습니다.");
				continue;
			}

			currentMember = member;
			System.out.println("로그인 성공");
			displayMenu();
			break;
		}
	}

	public void displayMenu() {

		while (true) {
			String name = currentMember.getName();
			String starStr = "*".repeat(55);
			System.out.println(starStr);
			System.out.println("\t\t" + name + "님 안녕하세요?");
			System.out.println(starStr);
			System.out.print("1. 회원 정보 확인하기\t\t");
			System.out.println("2. 회원 정보 수정하기");
			System.out.print("3. 회원 탈퇴\t\t\t");
			System.out.println("4. 종료");
			System.out.println(starStr);
			System.out.print("메뉴 번호를 선택해주세요: ");

			int selNum = s.nextInt();
			s.nextLine();

			if (selNum == 1) {
				selectMember();
			} else if (selNum == 2) {
				updateMember();
			} else if (selNum == 3) {
				deleteMember();
			} else if (selNum == 4) {
				System.out.println("시스템을 종료합니다.");
				System.exit(0);
			} else {
				System.out.println("다시 선택해주세요.");
			}
		}
	}

	private void selectMember() {
		System.out.print("조회할 회원 이름을 입력하세요: ");
		String searchName = s.nextLine();

		MemberVO2 member = dao.findMemberByName(searchName);

		if (member != null) {
			System.out.println(searchName + " 고객 정보:");
			System.out.print("회원번호 : " + member.getNum() + "\t");
			System.out.print("이름 : " + member.getName() + "\t");
			System.out.print("연락처 : " + member.getPhone() + "\t");
			System.out.println("주소 : " + member.getAddr());
		} else {
			System.out.println("해당 회원이 존재하지 않습니다.");
		}
	}

	private void updateMember() {
		System.out.print("수정할 회원 이름을 입력하세요: ");
		String searchName = s.nextLine();

		MemberVO2 member = dao.findMemberByName(searchName);

		if (member != null) {
			System.out.print("비밀번호를 입력하세요: ");
			String currentPass = s.nextLine();

			if (!currentPass.equals(dao.getPassword(searchName))) {
				System.out.println("비밀번호가 일치하지 않습니다. 수정할 수 없습니다.");
				return;
			}

			String oldName = member.getName();

			System.out.println("수정할 정보를 입력하세요.");
			System.out.print(searchName + " 회원의 이름을 수정하세요: ");
			String newName = s.nextLine();
			if (!newName.isEmpty()) {
			    member.setName(newName);
			}
			System.out.print(searchName + " 회원의 전화번호를 수정하세요: ");
			String newPhone = s.nextLine();
			if (!newPhone.isEmpty()) {
			    member.setPhone(newPhone);
			}
			System.out.print(searchName + " 회원의 주소를 수정하세요: ");
			String newAddr = s.nextLine();
			if (!newAddr.isEmpty()) {
			    member.setAddr(newAddr);
			}
			System.out.print(searchName + " 회원의 비밀번호를 수정하세요: ");
			String newPass = s.nextLine().trim(); // 입력값 앞뒤 공백 제거
			if (newPass.isEmpty()) { // 빈값이면 기존 값 유지
			    newPass = dao.getPassword(searchName);
			}
			member.setPass(newPass);



			dao.updateMemberFile(member, newPass, oldName);
			dao.loadMemberData();
			dao.loadPasswordData();

			System.out.println("회원 정보가 수정되었습니다.");
		} else {
			System.out.println("해당 회원이 존재하지 않습니다.");
		}
	}

	private void deleteMember() {
		System.out.println("회원 탈퇴를 진행합니다.");

		System.out.print("비밀번호를 입력하세요: ");
		String inputPass = s.nextLine();

		if (!inputPass.equals(dao.getPassword(currentMember.getName()))) {
			System.out.println("비밀번호가 일치하지 않습니다. 탈퇴할 수 없습니다.");
			return;
		}
		dao.deleteMember(currentMember.getName());

		System.out.println("회원 탈퇴가 완료되었습니다.");
	    currentMember = null; // 현재 회원 객체 삭제

	    start(); // 초기 화면으로 돌아감



	}
}
