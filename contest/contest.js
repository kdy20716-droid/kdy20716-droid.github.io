/**
 * 2026 겜브과 x VALORANT 자낳대 UI Logic
 */
document.addEventListener('DOMContentLoaded', () => {
    // 1. 네비게이션 바 상단 고정 및 배경 변경
    const nav = document.querySelector('nav');
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            nav.classList.add('bg-[#0F1923]', 'shadow-2xl');
            nav.classList.remove('bg-[#0F1923]/90');
        } else {
            nav.classList.remove('bg-[#0F1923]', 'shadow-2xl');
            nav.classList.add('bg-[#0F1923]/90');
        }
    });

    if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', toggleMobileMenu);
    }

    // 2. 대진표 매치 클릭 이벤트 (매치 프리뷰 애니메이션)
    const matchCards = document.querySelectorAll('#bracket .group.cursor-pointer');
    
    matchCards.forEach(card => {
        card.addEventListener('click', () => {
            // 더 정확한 선택자를 사용하여 팀 이름을 가져옵니다.
            const teamNames = card.querySelectorAll('span.font-bold');
            if (teamNames.length >= 2) {
                const teamAName = teamNames[0].textContent.trim();
                const teamBName = teamNames[1].textContent.trim();
                const matchDate = card.querySelector('p.text-\\[10px\\]').textContent.trim();
                
                openMatchModal(teamAName, teamBName, matchDate);
            }
        });
    });

    // 3. 요소 등장 애니메이션 (Reveal on Scroll)
    const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
            }
        });
    }, { threshold: 0.1 });

    const bracketSections = document.querySelectorAll('.bracket-card');
    bracketSections.forEach((el, index) => {
        el.classList.add('reveal-item');
        el.style.transitionDelay = `${index * 0.1}s`;
        revealObserver.observe(el);
    });
});

/**
 * 매치 프리뷰 모달 열기
 */
function openMatchModal(teamA, teamB, date) {
    const modal = document.getElementById('matchModal');
    const teamLeftName = document.getElementById('teamLeftName');
    const teamRightName = document.getElementById('teamRightName');
    const matchDateDisplay = document.getElementById('matchDateDisplay');
    
    // 데이터 설정
    teamLeftName.textContent = teamA;
    teamRightName.textContent = teamB;
    matchDateDisplay.textContent = date.includes('2026') ? date.replace('KST', '').trim() : "2026.00.00 00시00분";

    // 모달 표시
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    // 1단계: 팀 이름 슬라이드 인
    setTimeout(() => {
        modal.classList.add('match-modal-active');
    }, 100);

    // 2단계: 충돌 효과 및 VS 등장 (충돌 타이밍에 맞춰)
    setTimeout(() => {
        modal.classList.add('match-modal-impact');
        createSparks(); // 충돌 스파크 생성
        // 사운드 효과가 있다면 여기서 재생 가능
    }, 600);
}

/**
 * 충돌 시 튀는 스파크 생성
 */
function createSparks() {
    const container = document.getElementById('impactSparks');
    const sparkCount = 30;
    
    // 기존 스파크 제거
    container.innerHTML = '';

    for (let i = 0; i < sparkCount; i++) {
        const spark = document.createElement('div');
        spark.className = 'spark';
        
        // 중앙에서 시작
        spark.style.left = '50%';
        spark.style.top = '50%';
        
        // 랜덤한 방향과 거리 계산
        const angle = Math.random() * Math.PI * 2;
        const distance = 100 + Math.random() * 300;
        const tx = Math.cos(angle) * distance + 'px';
        const ty = Math.sin(angle) * distance + 'px';
        
        spark.style.setProperty('--tx', tx);
        spark.style.setProperty('--ty', ty);
        
        // 애니메이션 적용
        const duration = 0.4 + Math.random() * 0.6;
        spark.style.animation = `spark-fly ${duration}s ease-out forwards`;
        
        container.appendChild(spark);
    }
}

/**
 * 매치 프리뷰 모달 닫기
 */
function closeMatchModal() {
    const modal = document.getElementById('matchModal');
    modal.classList.remove('match-modal-active', 'match-modal-impact');
    
    setTimeout(() => {
        modal.classList.add('hidden');
        document.body.style.overflow = 'auto';
    }, 300);
}

/**
 * 팀 명단 모달 (기존 로직 유지)
 */
function openTeamModal() {
    document.getElementById('teamModal').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closeTeamModal() {
    document.getElementById('teamModal').classList.add('hidden');
    document.body.style.overflow = 'auto';
}

/**
 * 모바일 메뉴 토글
 */
function toggleMobileMenu() {
    const mobileMenu = document.getElementById('mobileMenu');
    if (mobileMenu) {
        mobileMenu.classList.toggle('hidden');
    }
}
