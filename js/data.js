/*
 * 카페 데이터 — B2-1(디자인 시안) 에서 확정한 것을 그대로 옮겼습니다.
 *
 * 왜 별도 파일인가: 화면 3개(메인·목록·상세)가 같은 데이터를 봅니다. 각 페이지에 복사해 두면
 * 카페 하나를 고칠 때 세 군데를 고쳐야 하고, 한 곳을 빠뜨리면 화면마다 다른 값이 보입니다.
 * 데이터를 한 곳에 두면 "무엇을 보여줄지"와 "어떻게 보여줄지"가 분리됩니다.
 *
 * 실제 서비스라면 이 자리가 데이터베이스나 장소 API 응답입니다. 이 미션의 평가 대상은
 * 프론트 구조와 AI 기능 연동이므로, 데이터는 시안에서 정한 값으로 고정했습니다.
 */

const CAFES = [
  {
    id: 'brew-haven',
    name: 'Brew Haven',
    rating: 4.8,
    distanceKm: 1.1,
    tags: ['조용함', '작업하기 좋음', '원목 인테리어'],
    summary: '펜던트 조명과 원목 테이블. 노트북 작업하기 좋은 자리가 많습니다.',
    menu: [
      { name: 'Cappuccino', price: 4.5 },
      { name: 'Latte', price: 4.0 },
      { name: 'Espresso', price: 5.0 },
    ],
    reviews: [
      { author: 'Sarah K.', stars: 5, text: '자리 간격이 넓어서 오래 앉아 있기 좋아요.' },
      { author: 'John D.', stars: 3, text: '커피는 훌륭한데 주말 오후엔 자리가 없습니다.' },
    ],
  },
  {
    id: 'arabica',
    name: 'Arabica',
    rating: 4.4,
    distanceKm: 0.12,
    tags: ['가까움', '테이크아웃', '싱글 오리진'],
    summary: '걸어서 2분. 싱글 오리진 원두를 매주 바꿉니다. 좌석은 적은 편입니다.',
    menu: [
      { name: 'Filter Coffee', price: 4.0 },
      { name: 'Flat White', price: 4.5 },
    ],
    reviews: [{ author: 'Mina P.', stars: 4, text: '출근길에 들르기 딱 좋은 위치.' }],
  },
  {
    id: 'coffee-house',
    name: 'Coffee House',
    rating: 4.2,
    distanceKm: 0.3,
    tags: ['넓음', '단체석', '디저트'],
    summary: '2층까지 좌석이 있어 일행이 많아도 앉을 수 있습니다.',
    menu: [
      { name: 'Americano', price: 3.5 },
      { name: 'Cheesecake', price: 6.0 },
    ],
    reviews: [{ author: 'Dohee L.', stars: 4, text: '넷이 갔는데 자리가 남았어요.' }],
  },
  {
    id: 'brown-cafe',
    name: 'Brown Cafe',
    rating: 4.5,
    distanceKm: 0.2,
    tags: ['분위기', '사진 찍기 좋음', '디저트'],
    summary: 'warm brown 톤 인테리어. 창가 자리 채광이 좋습니다.',
    menu: [
      { name: 'Cafe Mocha', price: 5.0 },
      { name: 'Tiramisu', price: 6.5 },
    ],
    reviews: [{ author: 'Jaewon S.', stars: 5, text: '창가 자리 사진이 잘 나옵니다.' }],
  },
  {
    id: 'cafe-aroma',
    name: 'Cafe Aroma',
    rating: 4.1,
    distanceKm: 0.8,
    tags: ['디카페인', '늦게까지', '조용함'],
    summary: '밤 11시까지 영업. 디카페인 선택지가 많습니다.',
    menu: [
      { name: 'Decaf Latte', price: 4.5 },
      { name: 'Herbal Tea', price: 4.0 },
    ],
    reviews: [{ author: 'Haeun K.', stars: 4, text: '늦은 시간에 갈 곳이 여기뿐이에요.' }],
  },
  {
    id: 'coffeeshop',
    name: 'Coffeeshop',
    rating: 3.9,
    distanceKm: 0.5,
    tags: ['가성비', '빠름', '테이크아웃'],
    summary: '주문부터 수령까지 빠릅니다. 가격대가 낮습니다.',
    menu: [
      { name: 'Americano', price: 2.8 },
      { name: 'Cafe Latte', price: 3.2 },
    ],
    reviews: [{ author: 'Seokjin H.', stars: 4, text: '급할 때 제일 먼저 떠오르는 곳.' }],
  },
];

/** id 로 카페 하나를 찾는다. 없으면 undefined — 호출한 쪽이 안내 화면을 띄운다. */
function findCafe(id) {
  return CAFES.find((cafe) => cafe.id === id);
}
