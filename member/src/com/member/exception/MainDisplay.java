package com.member.exception;

import java.io.BufferedWriter;
import java.io.File;
import java.io.FileOutputStream;
import java.io.FileWriter;
import java.io.PrintWriter;
import java.util.List;
import java.util.Scanner;

import com.member.domain.MemberVO;
import com.member.controller.MemberDAO;

public class MainDisplay {

	private MemberDAO memberDAO = new MemberDAO(); // DAO를 한 번만 생성
	Scanner s = new Scanner(System.in);

	public void start() {
		// TODO Auto-generated method stub

		String starStr = "*".repeat(55);

		Scanner s = new Scanner(System.in);

		System.out.println(starStr);
		System.out.println("\t\t\t로그인");
		System.out.println(starStr);

		int attempts = 0; // 비밀번호 입력 시도 횟수

		while (true) {
			System.out.print("아이디를 입력하세요: ");
			String id = s.nextLine();

			// 아이디 검증
			if (!id.equals(MemberVO.ADMIN.getName())) {
				System.out.println("일치하는 아이디가 없습니다.");
				continue; // 아이디 틀리면 즉시 다시 입력받음
			}

			System.out.print("비밀번호를 입력하세요: ");
			String pass = s.nextLine();

			if (pass.equals(MemberVO.ADMIN.getPass())) {
				System.out.println("로그인 성공");
				displayMenu();
			} else {
				attempts++;
				if (attempts < 3) {
					System.out.println("비밀번호가 틀렸습니다.");
				} else {
					System.out.println("로그인 횟수 초과. 프로그램을 종료합니다.");
					s.close();
					System.exit(0); // 프로그램 강제 종료
				}
			}
		}
	}

	public void displayMenu() {

		while (true) {
			// 메뉴 출력
			String starStr = "*".repeat(55);
			System.out.println(starStr);
			System.out.println("\t\t회원 관리 시스템");
			System.out.println(starStr);
			System.out.print("1. 회원 정보 등록하기\t\t");
			System.out.println("2. 회원 정보 조회하기");
			System.out.print("3. 회원 정보 수정하기\t\t");
			System.out.println("4. 회원 정보 삭제하기");
			System.out.print("5. 회원 정보 목록보기\t\t");
			System.out.println("6. 회원 정보 파일출력");
			System.out.println("7. 종료");
			System.out.println(starStr);
			System.out.print("메뉴 번호를 선택해주세요: ");

			int selNum = s.nextInt();
			s.nextLine();
			if (selNum == 1) {
				insertMember();
			} else if (selNum == 2) {
				selectMember();
			} else if (selNum == 3) {
				updateMember();
			} else if (selNum == 4) {
				deleteMember();
			} else if (selNum == 5) {
				viewMember();
			} else if (selNum == 6) {
				fileMember();
			} else if (selNum == 7) {
				System.out.println("시스템을 종료합니다.");
				System.exit(0); // 종료 조건 추가
			} else {
				System.out.println("다시 선택해주세요.");
			}
		}
	}

	private void insertMember() {
		String name;

		while (true) { // 이름 입력을 반복하는 루프
			System.out.print("등록하실 회원의 이름을 입력하세요: ");
			name = s.nextLine();

			// 중복 체크
			if (memberDAO.isNameDuplicate(name)) { // 중복 검사 메서드 사용
				System.out.println(name + "은(는) 이미 등록된 회원입니다. 다시 입력하세요.");
			} else {
				break; // 중복되지 않으면 루프 종료
			}
		}

		System.out.print("등록하실 회원의 연락처를 입력하세요: ");
		String phone = s.nextLine();

		System.out.print("등록하실 회원의 주소를 입력하세요: ");
		String addr = s.nextLine();

		System.out.print("등록하실 회원의 비밀번호를 입력하세요: ");
		String pass = s.nextLine();

		// 회원 정보 저장
		boolean success = memberDAO.insertMember(name, phone, addr, pass);
		if (success) {
			System.out.println("등록 완료되었습니다.");
		} else {
			System.out.println("등록 실패했습니다.");
		}

		displayMenu();
	}

	private void selectMember() {
		System.out.println("조회할 회원의 이름을 입력해주세요");
		String name = s.nextLine();

		MemberVO member = memberDAO.searchMemberByName(name);

		if (member != null) {
			System.out.println(name + "회원 정보: " + member);
		} else {
			System.out.println("해당 회원이 존재하지 않습니다.");
		}

		displayMenu();
	}

	private void updateMember() {
		System.out.print("수정할 회원의 이름을 입력하세요 : ");
		String name = s.nextLine();

		MemberVO member = memberDAO.searchMemberByName(name);

		System.out.print(name + "회원의 이름을 수정하세요 : ");
		String newName = s.nextLine();

		System.out.print(name + "회원의 연락처를 수정하세요 : ");
		String newPhone = s.nextLine();

		System.out.print(name + "회원의 주소를 수정하세요 : ");
		String newAddr = s.nextLine();

		System.out.print(name + "회원의 비밀번호를 수정하세요 : ");
		String newPass = s.nextLine();
		System.out.println();

		boolean success = memberDAO.updateMember(member.getNum(), newName, newPhone, newAddr, newPass);

		if (success) {
			System.out.println(name + "님의 정보가 수정 되었습니다.");
		}
		displayMenu();
	}

	private void deleteMember() {
		Scanner s = new Scanner(System.in);

		System.out.print("삭제할 회원의 이름을 입력하세요: ");
		String name = s.nextLine();

		System.out.print("비밀번호를 입력하세요: ");
		String password = s.nextLine();

		boolean success = memberDAO.deleteMember(name, password);

		if (success) {
			System.out.println(name + " 회원이 삭제되었습니다.");
		} else {
			System.out.println("회원 이름 또는 비밀번호가 올바르지 않습니다.");
		}

		displayMenu();
	}

	private void viewMember() {
		List<MemberVO> members = memberDAO.getAllMembers();

		if (members.isEmpty()) {
			System.out.println("❌ 등록된 회원이 없습니다.");
			return;
		}

		for (MemberVO member : members) {
			System.out.println(
					"회원번호 : " + member.getNum() + "\t이름 : " + member.getName() + "\t연락처 : " + member.getPhone());
		}

		displayMenu();
	}

	private void fileMember() {
		File memberFile = new File("MemberList.txt");

		try {
			if (!memberFile.exists()) {
				memberFile.createNewFile(); // 파일이 없으면 생성
			}

			// 파일 쓰기 위한 FileWriter & BufferedWriter 설정
			FileWriter fw = new FileWriter(memberFile);
			BufferedWriter bw = new BufferedWriter(fw);
			PrintWriter pw = new PrintWriter(bw);

			// 회원 목록 가져오기
			List<MemberVO> members = memberDAO.getAllMembers();

			if (members.isEmpty()) {
				pw.println("등록된 회원이 없습니다.");
			} else {
				for (MemberVO member : members) {
					pw.println("회원 번호 : " + member.getNum() + "\t이름 : " + member.getName() + "\t전화번호 : "
							+ member.getPhone() + "\t주소 : " + member.getAddr());
				}
			}

			pw.close();
			bw.close();
			fw.close();

			System.out.println("회원 목록이 'MemberList.txt'에 저장되었습니다.");

		} catch (Exception e) {
			System.out.println("파일 저장 중 오류 발생: " + e.getMessage());
		}
	}
}
