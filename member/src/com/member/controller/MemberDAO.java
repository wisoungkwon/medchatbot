package com.member.controller;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import com.member.domain.MemberVO;

public class MemberDAO {
	private static List<MemberVO> memberList = new ArrayList<>(); // 회원 목록
	private static int nextMemberNum = 1;

	// 회원 정보 등록
	public static boolean insertMember(String name, String phone, String addr, String pass) {
		for (MemberVO member : memberList) {
			if (member.getName().equalsIgnoreCase(name)) { // 대소문자 무시 비교
				System.out.println(name + "은(는) 이미 등록된 회원입니다. 다른 이름으로 등록해주세요.");
				return false; // 등록 실패 (중복)
			}
		}

		MemberVO newMember = new MemberVO(nextMemberNum, name, phone, addr, pass);
		memberList.add(newMember);
		nextMemberNum++;
		return true; // 등록 성공
	}

	// 회원 정보 조회
	public static MemberVO searchMemberByName(String name) {
		for (MemberVO member : memberList) {
			if (member.getName().equalsIgnoreCase(name)) { // 대소문자 구분 없이 비교
				return member;
			}
		}
		return null; // 회원이 없을 경우
	}

	// 회원 정보 수정
	public boolean updateMember(int num, String name, String phone, String addr, String pass) {
		for (MemberVO member : memberList) {
			if (member.getNum() == num) {
				member.setName(name);
				member.setPhone(phone);
				member.setAddr(addr);
				member.setPass(pass);
				return true; // 수정 성공
			}
		}
		return false; // 수정 실패
	}

	// 회원 정보 삭제
	public boolean deleteMember(String name, String password) {
		Iterator<MemberVO> iterator = memberList.iterator();

		while (iterator.hasNext()) {
			MemberVO member = iterator.next();
			if (member.getName().equalsIgnoreCase(name) && member.getPass().equals(password)) { // 이름 & 비밀번호 체크
				iterator.remove(); // 리스트에서 회원 삭제
				return true; // 삭제 성공
			}
		}
		return false; // 삭제 실패 (이름 또는 비밀번호 불일치)
	}

	// 회원 정보 목록
	public List<MemberVO> getAllMembers() {
		return memberList; // 전체 회원 목록 반환
	}

	public boolean isNameDuplicate(String name) {
		for (MemberVO member : memberList) {
			if (member.getName().equalsIgnoreCase(name)) { // 대소문자 무시하고 비교
				return true; // 중복된 이름이 존재함
			}
		}
		return false; // 중복 없음

	}

	// 회원 정보 파일 저장

}