// Ensure DOM is fully loaded before running scripts
document.addEventListener("DOMContentLoaded", () => {
  // --- Navbar Scroll Effect ---
  const navbar = document.getElementById("navbar");
  if (navbar) {
    window.addEventListener("scroll", () => {
      if (window.scrollY > 50) {
        navbar.classList.add("scrolled");
      } else {
        navbar.classList.remove("scrolled");
      }
    });
  }

  // --- Mobile Menu Toggle ---
  const menuToggle = document.querySelector(".menu-toggle");
  const navLinks = document.querySelector(".nav-links");

  if (menuToggle && navLinks) {
    menuToggle.addEventListener("click", () => {
      navLinks.classList.toggle("active");
    });
  }

  // --- Theme Switcher ---
  const themeSwitch = document.querySelector(".theme-switch");
  const themeIcon = themeSwitch ? themeSwitch.querySelector("i") : null;

  if (themeSwitch && themeIcon) {
    themeSwitch.addEventListener("click", () => {
      document.body.classList.toggle("dark-mode");
      themeIcon.classList.add("switching");
      setTimeout(() => {
        if (document.body.classList.contains("dark-mode")) {
          themeIcon.classList.replace("fa-moon", "fa-sun");
        } else {
          themeIcon.classList.replace("fa-sun", "fa-moon");
        }
        themeIcon.classList.remove("switching");
      }, 300);
    });
  }

  // --- Typing Effect ---
  class TypeWriter {
    constructor(txtElement, words, wait = 3000) {
      this.txtElement = txtElement;
      this.words = words;
      this.txt = "";
      this.wordIndex = 0;
      this.wait = parseInt(wait, 10);
      this.type();
      this.isDeleting = false;
    }

    type() {
      const current = this.wordIndex % this.words.length;
      const fullTxt = this.words[current];

      if (this.isDeleting) {
        this.txt = fullTxt.substring(0, this.txt.length - 1);
      } else {
        this.txt = fullTxt.substring(0, this.txt.length + 1);
      }

      this.txtElement.innerHTML = `<span class="txt">${this.txt}</span>`;

      let typeSpeed = 200;
      if (this.isDeleting) {
        typeSpeed /= 2;
      }

      if (!this.isDeleting && this.txt === fullTxt) {
        typeSpeed = this.wait;
        this.isDeleting = true;
      } else if (this.isDeleting && this.txt === "") {
        this.isDeleting = false;
        this.wordIndex++;
        typeSpeed = 500;
      }

      setTimeout(() => this.type(), typeSpeed);
    }
  }

  const txtElement = document.querySelector(".txt-type");
  if (txtElement) {
    const words = JSON.parse(txtElement.getAttribute("data-words"));
    const wait = txtElement.getAttribute("data-wait");
    new TypeWriter(txtElement, words, wait);
  }

  // --- Portfolio Modal ---
  const modal = document.getElementById("portfolio-modal");
  if (modal) {
    const modalImg = modal.querySelector(".modal-img");
    const modalTitle = modal.querySelector(".modal-title");
    const modalText = modal.querySelector(".modal-text");
    const modalLink = modal.querySelector(".modal-link");
    const closeBtn = modal.querySelector(".close-modal");
    const portfolioItems = document.querySelectorAll(".portfolio-item");

    portfolioItems.forEach((item) => {
      item.addEventListener("click", () => {
        const img = item.querySelector("img").src;
        const title = item.getAttribute("data-title");
        const desc = item.getAttribute("data-desc");
        const url = item.getAttribute("data-url");

        if (modalImg) modalImg.src = img;
        if (modalTitle) modalTitle.innerText = title;
        if (modalText) modalText.innerText = desc;

        if (url) {
          if (modalLink) {
            modalLink.href = url;
            modalLink.style.display = "inline-block";
          }
        } else {
          if (modalLink) modalLink.style.display = "none";
        }

        modal.style.display = "block";
        document.body.style.overflow = "hidden";
      });
    });

    if (closeBtn) {
      closeBtn.addEventListener("click", () => {
        modal.style.display = "none";
        document.body.style.overflow = "auto";
      });
    }

    window.addEventListener("click", (e) => {
      if (e.target === modal) {
        modal.style.display = "none";
        document.body.style.overflow = "auto";
      }
    });
  }

  // --- Skill Modal ---
  const skillModal = document.getElementById("skill-modal");
  if (skillModal) {
    const skillModalTitle = skillModal.querySelector(".skill-modal-title");
    const skillModalDesc = skillModal.querySelector(".skill-modal-desc");
    const skillModalLink = skillModal.querySelector(".skill-modal-link");
    const skillModalImg = skillModal.querySelector(".skill-modal-img");
    const closeSkillBtn = skillModal.querySelector(".close-skill-modal");
    const skillTags = document.querySelectorAll(".skill-tag");

    skillTags.forEach((tag) => {
      tag.addEventListener("click", () => {
        const content = tag.innerHTML;
        const desc = tag.getAttribute("data-desc");
        const url = tag.getAttribute("data-url");
        const image = tag.getAttribute("data-image");

        if (skillModalTitle) skillModalTitle.innerHTML = content;
        if (skillModalDesc) skillModalDesc.innerText = desc;

        if (skillModalImg) {
          skillModalImg.src = image || "";
          skillModalImg.style.display = image ? "block" : "none";
        }

        if (url) {
          if (skillModalLink) {
            skillModalLink.href = url;
            skillModalLink.style.display = "inline-block";
          }
        } else {
          if (skillModalLink) skillModalLink.style.display = "none";
        }

        skillModal.style.display = "block";
        document.body.style.overflow = "hidden";
      });
    });

    if (closeSkillBtn) {
      closeSkillBtn.addEventListener("click", () => {
        skillModal.style.display = "none";
        document.body.style.overflow = "auto";
      });
    }

    window.addEventListener("click", (e) => {
      if (e.target === skillModal) {
        skillModal.style.display = "none";
        document.body.style.overflow = "auto";
      }
    });
  }
});
