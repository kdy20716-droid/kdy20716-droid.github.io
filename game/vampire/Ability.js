// 무기 정의
export const WEAPONS = {
  stapler: {
    name: "스테이플러",
    desc: "가장 가까운 적에게 심을 발사합니다.",
    icon: "📎",
    type: "projectile",
    damage: 10,
    cooldown: 60, // 프레임 단위
    speed: 7,
    count: 1,
    timer: 0,
    evolution: "stapler_evo",
  },
  coffee: {
    name: "뜨거운 커피",
    desc: "주변 적들에게 지속적인 피해를 줍니다.",
    icon: "☕",
    type: "aura",
    damage: 2,
    area: 60,
    cooldown: 18, // 0.3초 (60fps 기준 약 18프레임)
    timer: 0,
    evolution: "coffee_evo",
  },
  keyboard: {
    name: "키보드 샷건",
    desc: "무작위 방향으로 키보드를 던집니다.",
    icon: "⌨️",
    type: "projectile",
    damage: 25,
    cooldown: 90,
    speed: 4,
    count: 1,
    duration: 60, // 관통하며 날아가는 시간
    timer: 0,
    evolution: "keyboard_evo",
  },
  report: {
    name: "결재 서류",
    desc: "가장 체력이 높은 적을 추격하는 유도탄을 발사합니다.",
    icon: "📑",
    type: "homing_projectile", // 새로운 타입
    damage: 30,
    cooldown: 150,
    speed: 5,
    count: 1,
    timer: 0,
    evolution: "report_evo",
  },
  chair: {
    name: "회전 의자",
    desc: "플레이어 주위를 돌며 닿는 적에게 피해를 줍니다.",
    icon: "🪑",
    type: "orbiting", // 새로운 타입
    damage: 15,
    area: 100, // 회전 반경
    count: 1, // 의자 개수
    rotationSpeed: 0.05, // 회전 속도
    timer: 0,
    evolution: "chair_evo",
  },
  energy_drink: {
    name: "에너지 드링크",
    desc: "주기적으로 주변에 강력한 폭발을 일으킵니다.",
    icon: "💥",
    type: "explosion", // 새로운 타입
    damage: 50,
    area: 150, // 폭발 반경
    cooldown: 300,
    timer: 0,
    evolution: "energy_drink_evo",
  },
  airpods: {
    name: "에어팟 (노이즈 캔슬링)",
    desc: "보호막을 생성하여 1회 피해를 막습니다. (쿨타임 1분)",
    icon: "🎧",
    type: "shield",
    cooldown: 3600, // 60초 * 60프레임
    active: true, // 시작 시 활성화
    timer: 0,
    evolution: "airpods_evo",
  },
  // --- 진화 무기 (Lv.6) ---
  stapler_evo: {
    name: "머신건 스테이플러",
    desc: "엄청난 속도로 스테이플러 심을 난사합니다.",
    icon: "🔫",
    type: "projectile",
    damage: 20, // 데미지 하향 (30 -> 20)
    cooldown: 8, // 쿨타임 증가 (4 -> 8)
    speed: 12, // 탄속 소폭 하향
    count: 3,
    timer: 0,
    isEvolved: true,
  },
  coffee_evo: {
    name: "용암 커피",
    desc: "닿는 모든 것을 녹여버리는 뜨거운 커피 웅덩이를 생성합니다.",
    icon: "🌋",
    type: "aura",
    damage: 8, // 데미지 소폭 하향
    area: 150,
    cooldown: 10,
    timer: 0,
    isEvolved: true,
  },
  keyboard_evo: {
    name: "RGB 게이밍 키보드",
    desc: "화려한 LED와 함께 키보드를 사방으로 던집니다.",
    icon: "🌈",
    type: "projectile",
    damage: 60, // 데미지 하향
    cooldown: 40,
    speed: 8,
    count: 8, // 8방향 발사
    duration: 120,
    timer: 0,
    isEvolved: true,
  },
  report_evo: {
    name: "해고 통지서",
    desc: "적을 끝까지 추격하여 치명적인 피해를 입힙니다.",
    icon: "💀",
    type: "homing_projectile",
    damage: 150, // 데미지 하향
    cooldown: 60,
    speed: 10,
    count: 3,
    timer: 0,
    isEvolved: true,
  },
  chair_evo: {
    name: "CEO 의자",
    desc: "최고급 의자가 고속으로 회전하며 적들을 갈아버립니다.",
    icon: "👑",
    type: "orbiting",
    damage: 40, // 데미지 하향
    area: 180,
    count: 4,
    rotationSpeed: 0.15,
    timer: 0,
    isEvolved: true,
  },
  energy_drink_evo: {
    name: "핵융합 드링크",
    desc: "화면 전체에 가까운 범위에 폭발을 일으킵니다.",
    icon: "☢️",
    type: "explosion",
    damage: 300, // 데미지 하향
    area: 400,
    cooldown: 180,
    timer: 0,
    isEvolved: true,
  },
  airpods_evo: {
    name: "방음 헤드셋",
    desc: "더 자주 보호막이 생성되며, 파괴 시 주변 적을 밀쳐냅니다.",
    icon: "🎧",
    type: "shield",
    cooldown: 1200, // 20초
    active: true,
    timer: 0,
    isEvolved: true,
  },
};

// 패시브 정의
export const PASSIVES = {
  shoes: {
    name: "편한 슬리퍼",
    desc: "이동 속도가 증가합니다.",
    icon: "🩴",
    stat: "speed",
    val: 0.3, // 밸런스 조정
    maxLevel: 3,
  },
  coffee_mix: {
    name: "카페인 수혈",
    desc: "공격 속도가 빨라집니다.",
    icon: "💊",
    stat: "cooldown",
    val: 0.08, // 밸런스 조정
    maxLevel: 3,
  },
  dumbbell: {
    name: "야근 근육",
    desc: "공격력이 증가합니다.",
    icon: "💪",
    stat: "might",
    val: 0.15, // 밸런스 조정
    maxLevel: 3,
  },
  book: {
    name: "업무 메뉴얼",
    desc: "경험치 획득량이 20% 증가합니다.",
    icon: "📖",
    stat: "exp_gain", // 새로운 스탯
    val: 0.2,
    maxLevel: 3,
  },
  cushion: {
    name: "푹신한 방석",
    desc: "최대 체력이 20% 증가합니다.",
    icon: "❤️‍🩹",
    stat: "max_hp", // 새로운 스탯
    val: 0.2,
    maxLevel: 3,
  },
  magnet: {
    name: "법인 카드",
    desc: "경험치 획득 범위가 늘어납니다.",
    icon: "💳",
    stat: "area",
    val: 0.5,
    maxLevel: 3,
  },
};
