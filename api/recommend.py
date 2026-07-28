"""Vercel Serverless Function — 취향 문장을 받아 카페 추천 문구를 만든다.

배치 규칙: Vercel 은 `api/` 폴더의 파일 하나를 엔드포인트 하나로 만든다.
이 파일이 `api/recommend.py` 이므로 배포 후 주소는 **`/api/recommend`** 이고,
프론트의 `fetch('/api/recommend')` 가 그대로 닿는다. 라우팅 설정을 따로 쓰지 않는다.

진입점 규칙: 클래스 이름은 반드시 `handler` 이고 `BaseHTTPRequestHandler` 를 상속한다.
Vercel 런타임이 이 이름을 찾아 요청마다 인스턴스를 만든다(우리가 서버를 띄우지 않는다).

왜 서버가 필요한가 — **API 키 때문**이다. 브라우저 JavaScript 에서 AI API 를 직접 부르면
키가 사용자에게 그대로 노출된다(개발자 도구에서 보인다). 키를 아는 순간 누구나 내 계정으로
호출할 수 있고 요금은 나에게 청구된다. 그래서 키는 서버 환경변수에만 두고, 브라우저는
'우리 서버'만 부른다.
"""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler

OPENAI_URL = "https://api.openai.com/v1/chat/completions"
MODEL = "gpt-4o-mini"
KEY_NAME = "OPENAI_API_KEY"  # 값이 아니라 **이름만** 코드에 둔다

MAX_WISH_LEN = 200  # 입력 상한 — 긴 문장은 토큰 비용만 늘리고 추천 품질을 올리지 않는다
UPSTREAM_TIMEOUT = 10  # 프론트가 12초에 끊으므로 그보다 짧게 잡아 먼저 정리한다


def build_prompt(wish: str, cafes: list[dict]) -> str:
    """사용자 취향 + 카페 목록 → LLM 지시문.

    카페 목록을 함께 넣는 이유: 모델이 아는 아무 카페나 지어내면 우리 서비스에 없는 곳을
    추천하게 된다. **고를 수 있는 후보를 명시**하고 그 안에서만 고르게 한다.
    """
    catalog = "\n".join(
        f"- {c.get('name')} (평점 {c.get('rating')}, {c.get('distanceKm')}km,"
        f" 특징: {', '.join(c.get('tags') or [])})"
        for c in cafes
    )
    return (
        "너는 동네 카페를 추천하는 큐레이터다.\n"
        f"사용자가 원하는 것: {wish}\n\n"
        f"[고를 수 있는 카페 — 이 목록 밖은 추천하지 마라]\n{catalog}\n\n"
        "[출력 규칙]\n"
        "- 목록에서 **한 곳**을 고르고, 왜 그 조건에 맞는지 2~3문장으로 설명하라.\n"
        "- 차선책 한 곳을 한 문장으로 덧붙여라.\n"
        "- 존재하지 않는 카페·메뉴·가격을 만들어 내지 마라.\n"
        "- 마크다운 표·코드블록 없이 평범한 문장으로만 답하라."
    )


def call_openai(api_key: str, prompt: str) -> str:
    """OpenAI Chat Completions 호출 → 답변 텍스트. 실패는 예외로 올린다."""
    body = json.dumps(
        {
            "model": MODEL,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.7,
            "max_tokens": 400,  # 응답 길이를 묶어 요금과 대기시간을 예측 가능하게 만든다
        }
    ).encode("utf-8")
    request = urllib.request.Request(
        OPENAI_URL,
        data=body,
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=UPSTREAM_TIMEOUT) as response:
        payload = json.loads(response.read().decode("utf-8"))
    return payload["choices"][0]["message"]["content"].strip()


class handler(BaseHTTPRequestHandler):  # noqa: N801 — Vercel 이 이 이름을 찾는다
    """POST /api/recommend — 본문 {"wish": "...", "cafes": [...]}"""

    def do_POST(self) -> None:  # noqa: N802 — BaseHTTPRequestHandler 규약
        try:
            length = int(self.headers.get("Content-Length") or 0)
            data = json.loads(self.rfile.read(length) or b"{}")
        except (ValueError, json.JSONDecodeError):
            self._send(400, {"error": "요청 본문이 올바른 JSON 이 아닙니다."})
            return

        wish = str(data.get("wish") or "").strip()
        cafes = data.get("cafes") or []

        # 입력 검증을 서버에서도 한다 — 브라우저 검증은 우회할 수 있으므로 신뢰하지 않는다
        if not wish:
            self._send(400, {"error": "원하는 분위기를 한 문장 이상 적어 주세요."})
            return
        if len(wish) > MAX_WISH_LEN:
            self._send(400, {"error": f"입력이 너무 깁니다({MAX_WISH_LEN}자 이내)."})
            return
        if not isinstance(cafes, list) or not cafes:
            self._send(400, {"error": "추천 대상 카페 목록이 비어 있습니다."})
            return

        api_key = os.environ.get(KEY_NAME, "").strip()
        if not api_key:
            # 키 미설정은 사용자 잘못이 아니다 — 서버 설정 문제로 알린다
            self._send(500, {"error": f"서버에 {KEY_NAME} 환경변수가 설정되지 않았습니다."})
            return

        try:
            text = call_openai(api_key, build_prompt(wish, cafes))
        except urllib.error.HTTPError as exc:
            # 상류 상태코드를 그대로 넘긴다 — 프론트가 코드별로 다른 안내를 띄운다
            self._send(exc.code, {"error": f"AI API 오류(HTTP {exc.code})"})
            return
        except urllib.error.URLError:
            self._send(504, {"error": "AI API 에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요."})
            return
        except (KeyError, IndexError, json.JSONDecodeError):
            self._send(502, {"error": "AI 응답 형식이 예상과 다릅니다."})
            return

        self._send(200, {"recommendation": text})

    def do_GET(self) -> None:  # noqa: N802
        """브라우저로 주소를 직접 열었을 때 안내 — 배포 확인용."""
        self._send(200, {"status": "ok", "usage": "POST /api/recommend {wish, cafes}"})

    def _send(self, status: int, payload: dict) -> None:
        """JSON 응답 한 곳 — 헤더 설정을 빠뜨리는 실수를 없앤다."""
        raw = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)
