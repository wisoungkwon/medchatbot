
package com.member2.controller;

import java.io.*;
import java.util.*;
import java.util.regex.*;
import com.member2.domain.MemberVO2;

public class MemberDAO2 {
	private final String MEMBER_FILE = "member.txt";
	private final String PASS_FILE = "pass.txt";
	private List<MemberVO2> members = new ArrayList<>();
	private Map<String, String> passwords = new HashMap<>();

	public List<MemberVO2> getMembers() {
		return members;
	}

	public Map<String, String> getPasswords() {
		return passwords;
	}

	public void loadMemberData() {
		File file = new File(MEMBER_FILE);
		if (!file.exists()) {
			System.out.println("회원 정보 파일이 존재하지 않습니다.");
			return;
		}

		members.clear();
		try (BufferedReader br = new BufferedReader(new FileReader(MEMBER_FILE))) {
			String line;
			Pattern pattern = Pattern
					.compile("회원번호\\s*:\\s*(\\d+)\\t이름\\s*:\\s*(\\S+)\\t연락처\\s*:\\s*(\\S+)\\t주소\\s*:\\s*(.+)");

			while ((line = br.readLine()) != null) {
				Matcher matcher = pattern.matcher(line);
				if (matcher.matches()) {
					int num = Integer.parseInt(matcher.group(1));
					String name = matcher.group(2);
					String phone = matcher.group(3);
					String addr = matcher.group(4);
					members.add(new MemberVO2(num, name, phone, addr, ""));
				} else {
					System.out.println("형식이 맞지 않는 줄: " + line);
				}
			}
		} catch (IOException e) {
			System.out.println("회원 정보 파일을 읽을 수 없습니다.");
			e.printStackTrace();
		}
	}

	public void loadPasswordData() {
		File file = new File(PASS_FILE);
		if (!file.exists()) {
			System.out.println("비밀번호 파일이 존재하지 않습니다.");
			return;
		}

		passwords.clear();
		Pattern pattern = Pattern.compile("^\\s*(\\S+)\\s*:\\s*(\\S+)\\s*$");

		try (BufferedReader br = new BufferedReader(new FileReader(PASS_FILE))) {
			String line;
			while ((line = br.readLine()) != null) {
				Matcher matcher = pattern.matcher(line);
				if (matcher.matches()) {
					passwords.put(matcher.group(1), matcher.group(2));
				} else {
					System.out.println("형식이 맞지 않는 비밀번호 줄: " + line);
				}
			}
		} catch (IOException e) {
			System.out.println("비밀번호 파일을 읽을 수 없습니다.");
			e.printStackTrace();
		}
	}

	// 이름으로 회원 찾기
	public MemberVO2 findMemberByName(String name) {
		for (MemberVO2 member : members) {
			if (member.getName().equals(name)) {
				return member;
			}
		}
		return null;
	}

	// 이름으로 비밀번호 조회
	public String getPassword(String name) {
		return passwords.getOrDefault(name, "");
	}

	// 수정된 회원을 업데이트
	public void updateMemberFile(MemberVO2 updatedMember, String newPass, String oldName) {
		// oldName과 일치하는 회원 정보 갱신
		for (int i = 0; i < members.size(); i++) {
			if (members.get(i).getName().equals(oldName)) {
				members.set(i, updatedMember);
				break;
			}
		}

		// 비밀번호도 업데이트
		if (!oldName.equals(updatedMember.getName())) {
			// 이름이 바뀐 경우, 키 이동
			passwords.remove(oldName);
		}
		passwords.put(updatedMember.getName(), newPass);

		// 파일 저장
		updateMemberFile();
		updatePasswordFile();
	}

	public void updateMemberFile() {
		try (BufferedWriter bw = new BufferedWriter(new FileWriter(MEMBER_FILE))) {
			for (MemberVO2 member : members) {
				String line = String.format("회원번호 : %d	이름 : %s	연락처 : %s	주소 : %s", member.getNum(), member.getName(),
						member.getPhone(), member.getAddr());
				bw.write(line);
				bw.newLine();
			}
		} catch (IOException e) {
			System.out.println("회원 정보 파일을 저장하는 중 오류 발생");
			e.printStackTrace();
		}
	}

	public void updatePasswordFile() {
		try (BufferedWriter bw = new BufferedWriter(new FileWriter(PASS_FILE))) {
			for (Map.Entry<String, String> entry : passwords.entrySet()) {
				String line = String.format("%s : %s", entry.getKey(), entry.getValue());
				bw.write(line);
				bw.newLine();
			}
		} catch (IOException e) {
			System.out.println("비밀번호 파일 저장 중 오류 발생");
			e.printStackTrace();
		}
	}

	public boolean deleteMember(String name) {
		boolean removed = members.removeIf(member -> member.getName().equals(name));
		if (removed) {
			passwords.remove(name);
			updateMemberFile();
			updatePasswordFile();
			System.out.println(name + " 회원이 삭제되었습니다.");
		} else {
			System.out.println("해당 이름의 회원을 찾을 수 없습니다.");
		}
		return removed;
	}

}
