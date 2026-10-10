#!/usr/bin/env sh
# office.html 은 claude.ai Artifact 원본(문서 뼈대 없음)입니다.
# 브라우저에서 바로 열 수 있도록 뼈대를 씌운 index.html 을 만듭니다.
set -e
cd "$(dirname "$0")"
{
  printf '<!doctype html>\n<html lang="ko">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n</head>\n<body style="margin:0">\n'
  cat office.html
  printf '\n</body>\n</html>\n'
} > index.html
echo "index.html 생성 완료"
