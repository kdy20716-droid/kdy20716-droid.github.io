/**
 * 2026 겜브과 x VALORANT 자낳대 UI Logic
 */
document.addEventListener('DOMContentLoaded', () => {
    // 1. 네비게이션 바 상단 고정 및 배경 변경
    const nav = document.querySelector('nav');
    
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            nav.classList.add('bg-[#0F1923]/95', 'py-2', 'backdrop-blur-lg');
            nav.classList.remove('bg-[#0F1923]/80', 'py-0');
        } else {
            nav.classList.remove('bg-[#0F1923]/95', 'py-2', 'backdrop-blur-lg');
            nav.classList.add('bg-[#0F1923]/80', 'py-0');
        }
    });

    // 2. 대진표 요소 순차 등장 애니메이션 (Intersection Observer)
    const observerOptions = {
        threshold: 0.15,
        rootMargin: '0px 0px -50px 0px'
    };

    const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
                // 한 번 나타난 후에는 관찰 중지
                revealObserver.unobserve(entry.target);
            }
        });
    }, observerOptions);

    // 대진표 내의 카드들에 reveal-item 클래스 부여 및 관찰 시작
    const bracketSections = document.querySelectorAll('#bracket > div, .bracket-card');
    bracketSections.forEach((el, index) => {
        el.classList.add('reveal-item');
        // 약간의 딜레이를 주어 순차적으로 나타나게 함
        el.style.transitionDelay = `${index * 0.1}s`;
        revealObserver.observe(el);
    });
});