package com.member2.domain;

import com.member2.domain.MemberVO2;

public class MemberVO2 {
	private int num;
	private String name;
	private String phone;
	private String addr;
	private String pass;

	public MemberVO2(int num, String name, String phone, String addr, String pass) {
		this.num = num;
		this.name = name;
		this.phone = phone;
		this.addr = addr;
		this.pass = pass;
	}

	public int getNum() {
		return num;
	}

	public void setNum(int num) {
		this.num = num;
	}

	public String getName() {
		return name;
	}

	public void setName(String name) {
		this.name = name;
	}

	public String getPhone() {
		return phone;
	}

	public void setPhone(String phone) {
		this.phone = phone;
	}

	public String getAddr() {
		return addr;
	}

	public void setAddr(String addr) {
		this.addr = addr;
	}

	public String getPass() {
		return pass;
	}

	public void setPass(String pass) {
		this.pass = pass;
	}

	@Override
	public String toString() {
		return "회원번호: " + num + ", 이름: " + name + ", 전화번호: " + phone + ", 주소: " + addr;
	}
}
