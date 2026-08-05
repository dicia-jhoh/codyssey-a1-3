"""자체 호스팅용 진입점 — 정적 파일 + `api/` 서버리스 함수를 한 프로세스로 서빙한다.

왜 이 파일이 있는가 — **GitHub Pages 같은 정적 호스팅은 `api/` 를 실행하지 못한다.**
HTML·CSS·JS 는 파일이라 그냥 내려주면 되지만, `api/recommend.py` 는 요청마다 실행돼야 하는
프로그램이다. 실행할 주체가 없으면 그 주소는 404/405 를 돌려준다. 그래서 AI 기능까지 살리려면
"파일을 내려주는 서버"가 아니라 "코드를 실행하는 서버"가 필요하다.

핵심은 **`api/` 안의 코드를 한 줄도 바꾸지 않는다**는 점이다. 각 파일의 `handler` 클래스를
그대로 가져다 쓴다. 배포처가 바뀌어도 기능 코드는 그대로고, 바뀌는 건 이 진입점뿐이다.

실행:
    python3 server.py            # 기본 8000 번 포트
    PORT=8037 python3 server.py  # 포트 지정

표준 라이브러리만 쓴다(`requirements.txt` 가 비어 있는 이유). 학습용 단일 프로세스 서버라
동시 접속이 많은 실서비스에는 맞지 않는다.
"""

from __future__ import annotations

import json
import os
import sys
from functools import partial
from http.server import HTTPServer, SimpleHTTPRequestHandler
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))  # api 패키지를 import 하기 위해 저장소 루트를 경로에 넣는다

from api import recommend, track  # noqa: E402 — sys.path 를 세운 뒤에야 import 가 된다

# 주소 → 그 주소를 처리할 모듈. 파일 위치로 추측하지 않고 여기 한 곳에 명시한다.
ROUTES = {"/api/recommend": recommend, "/api/track": track}


class Router(SimpleHTTPRequestHandler):
    """`/api/*` 는 서버리스 함수로, 나머지는 정적 파일로 넘긴다."""

    def do_POST(self) -> None:  # noqa: N802 — BaseHTTPRequestHandler 규약
        module = ROUTES.get(self.path.split("?")[0])
        if module is None:
            self._send(404, {"error": "존재하지 않는 API 주소입니다."})
            return
        # 함수를 우리 인스턴스에 얹어 부른다 — api/ 쪽 코드를 복사하지 않기 위해서다.
        module.handler.do_POST(self)

    def do_GET(self) -> None:  # noqa: N802
        module = ROUTES.get(self.path.split("?")[0])
        if module is None:
            super().do_GET()  # 정적 파일(index.html·css·js·images)
            return
        module.handler.do_GET(self)

    def _send(self, status: int, payload: dict) -> None:
        """api/ 의 handler 들이 호출하는 응답 함수. 시그니처를 동일하게 맞춰 둔다."""
        raw = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def log_message(self, format: str, *args) -> None:  # noqa: A002 — 기반 클래스 시그니처
        """journalctl 이 이미 시각을 붙이므로 기본 포맷의 중복 타임스탬프를 걷어낸다."""
        sys.stderr.write(f"{self.address_string()} {format % args}\n")


def main() -> int:
    port = int(os.environ.get("PORT", "8000"))
    server = HTTPServer(("0.0.0.0", port), partial(Router, directory=str(ROOT)))
    print(f"[server] http://0.0.0.0:{port}/  (정적 {ROOT}, API {', '.join(ROUTES)})", file=sys.stderr)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[server] 종료", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
