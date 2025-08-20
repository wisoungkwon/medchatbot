package com.medbot.controller;

import com.google.zxing.BarcodeFormat;
import com.google.zxing.WriterException;
import com.google.zxing.client.j2se.MatrixToImageWriter;
import com.google.zxing.qrcode.QRCodeWriter;
import com.google.zxing.common.BitMatrix;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

@Controller
public class QrController {

    // QR 이미지(바로 사용)
    @GetMapping(value = "/qrcode", produces = MediaType.IMAGE_PNG_VALUE)
    @ResponseBody
    public byte[] qrcode(
            @RequestParam(defaultValue = "/") String target,
            HttpServletRequest request
    ) throws WriterException, IOException {
        // 서버 베이스 URL 만들기 (http/https + 호스트 + 포트)
        String scheme = request.getScheme();                   // http
        String server = request.getServerName();               // 192.168.x.x or localhost
        int port = request.getServerPort();                    // 8080
        String base = scheme + "://" + server + ((port == 80 || port == 443) ? "" : ":" + port);

        // 타겟 URL (ex. http://192.168.0.10:8080/chatbot)
        String path = target.startsWith("/") ? target : ("/" + target);
        String url = base + path;

        // QR 생성
        int size = 320; // 픽셀
        QRCodeWriter writer = new QRCodeWriter();
        BitMatrix matrix = writer.encode(url, BarcodeFormat.QR_CODE, size, size);

        // PNG 바이트로 변환
        try (var baos = new java.io.ByteArrayOutputStream()) {
            MatrixToImageWriter.writeToStream(matrix, "PNG", baos);
            return baos.toByteArray();
        }
    }

    // QR 안내 페이지(스캔 가이드 + 미리보기)
    @GetMapping("/qr")
    public String qrLanding(
            @RequestParam(defaultValue = "/chatbot") String target,
            HttpServletRequest request,
            org.springframework.ui.Model model
    ) {
        String scheme = request.getScheme();
        String server = request.getServerName();
        int port = request.getServerPort();
        String base = scheme + "://" + server + ((port == 80 || port == 443) ? "" : ":" + port);

        String path = target.startsWith("/") ? target : ("/" + target);
        String fullUrl = base + path;

        // /qrcode?target=... 링크 (URL 인코딩)
        String encodedTarget = URLEncoder.encode(path, StandardCharsets.UTF_8);
        String qrImgSrc = "/qrcode?target=" + encodedTarget;

        model.addAttribute("fullUrl", fullUrl);
        model.addAttribute("qrImgSrc", qrImgSrc);
        model.addAttribute("targetPath", path);
        return "qr"; // templates/qr.html
    }
}
