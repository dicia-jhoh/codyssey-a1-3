"""API 함수 묶음.

`server.py` 가 `from api import recommend` 로 불러 각 요청을 해당 모듈의 `handler` 에 넘긴다.
파일 하나 = 엔드포인트 하나이며, 새 기능은 이 폴더에 파일을 더하고 `ROUTES` 에 한 줄 넣으면 된다.
"""
