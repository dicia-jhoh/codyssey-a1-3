"""보너스 — 사용 이벤트 수집 엔드포인트 (`POST /api/track`).

무엇을 푸는가: "다크 모드를 켰다", "AI 추천을 요청했다", "추천받은 카페 상세로 들어갔다"
같은 **행동**을 남긴다. 기능을 넣는 것과 그 기능이 쓰이는지 아는 것은 별개다.

저장을 어디에 하나 — Serverless 는 **호출 간 상태가 유지되지 않으므로** 함수 안 변수·파일에
쌓을 수 없다(다음 요청은 다른 인스턴스에서 실행된다). 그래서 두 갈래로 내보낸다:

  ① **구조화 로그** — 한 줄 JSON 으로 stdout 에 찍는다. Vercel 은 함수 로그를 수집하므로
     이 자체가 조회 가능한 저장소가 된다. 의존성 0, 실패 지점 0.
  ② **외부 도구 웹훅**(선택) — `TRACK_WEBHOOK_URL` 이 설정돼 있으면 같은 이벤트를 그쪽으로도
     보낸다. Slack·노코드 자동화(Make·Zapier)·시트 적재 어디든 URL 만 바꾸면 붙는다.

②를 **선택**으로 둔 이유: 수집이 서비스를 망가뜨리면 안 된다. 웹훅이 죽어도 사용자 화면은
아무 영향을 받지 않아야 하므로, 실패를 삼키고 200 을 돌려준다(로그에는 남긴다).
"""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler

WEBHOOK_ENV = "TRACK_WEBHOOK_URL"  # 실제 연동 시 이 자리에 외부 도구 URL 을 넣는다
WEBHOOK_TIMEOUT = 3  # 사용자 응답을 붙잡지 않도록 짧게

# 받을 이벤트 이름 — 허용 목록으로 제한한다. 아무 문자열이나 받으면 오타가 새 지표를 만들고
# 나중에 집계할 때 같은 행동이 두 이름으로 갈린다.
ALLOWED_EVENTS = {
    "page_view",  # 페이지 열람
    "theme_toggle",  # 다크 모드 전환
    "ai_request",  # AI 추천 요청
    "ai_success",  # 추천 문장을 받아 화면에 표시
    "ai_error",  # 실패(빈 입력·API 오류·타임아웃)
    "cafe_open",  # 카드에서 상세로 이동
    "reserve_click",  # 예약 버튼
}


def forward(event: dict) -> str:
    """외부 도구로 같은 이벤트를 흘려보낸다 → 결과 문자열(로그용)."""
    url = os.environ.get(WEBHOOK_ENV, "").strip()
    if not url:
        return "skipped(no-webhook)"
    body = json.dumps(event, ensure_ascii=False).encode("utf-8")
    request = urllib.request.Request(
        url, data=body, headers={"Content-Type": "application/json"}, method="POST"
    )
    try:
        with urllib.request.urlopen(request, timeout=WEBHOOK_TIMEOUT) as response:
            return f"forwarded({response.status})"
    except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError) as exc:
        # 수집 실패가 서비스 실패가 되면 안 된다 — 사유만 남기고 넘어간다
        return f"forward-failed({exc})"


class handler(BaseHTTPRequestHandler):  # noqa: N801 — Vercel 진입점 규약
    """POST /api/track — 본문 {"event": "ai_request", "detail": {...}}"""

    def do_POST(self) -> None:  # noqa: N802
        try:
            length = int(self.headers.get("Content-Length") or 0)
            data = json.loads(self.rfile.read(length) or b"{}")
        except (ValueError, json.JSONDecodeError):
            self._send(400, {"error": "본문이 올바른 JSON 이 아닙니다."})
            return

        name = str(data.get("event") or "").strip()
        if name not in ALLOWED_EVENTS:
            self._send(400, {"error": f"알 수 없는 이벤트: {name or '(없음)'}"})
            return

        event = {
            "event": name,
            "path": str(data.get("path") or "")[:120],
            "detail": data.get("detail") if isinstance(data.get("detail"), dict) else {},
        }

        # ① 구조화 로그 — 한 줄 JSON 이라 나중에 grep·파싱이 쉽다
        print(json.dumps({"track": event}, ensure_ascii=False), flush=True)
        # ② 외부 도구 전달(설정돼 있을 때만)
        result = forward(event)

        self._send(200, {"ok": True, "forward": result})

    def do_GET(self) -> None:  # noqa: N802
        """수집 설정 상태만 알려 준다 — URL 값 자체는 노출하지 않는다."""
        self._send(
            200,
            {
                "status": "ok",
                "webhook": bool(os.environ.get(WEBHOOK_ENV, "").strip()),
                "events": sorted(ALLOWED_EVENTS),
            },
        )

    def _send(self, status: int, payload: dict) -> None:
        raw = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)
