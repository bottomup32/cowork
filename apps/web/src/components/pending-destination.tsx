export function PendingDestination({ title }: { title: string }) {
  return <section className="pending-destination"><p className="eyebrow">준비 중</p><h1>{title}</h1><p>이 영역은 다음 작업에서 연결됩니다. 현재는 사용할 수 있는 데이터를 표시하지 않습니다.</p></section>;
}
