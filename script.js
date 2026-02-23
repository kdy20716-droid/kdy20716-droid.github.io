// Navbar Scroll Effect
const navbar = document.getElementById("navbar");
window.addEventListener("scroll", () => {
  if (window.scrollY > 50) {
    navbar.classList.add("scrolled");
  } else {
    navbar.classList.remove("scrolled");
  }
});

// Mobile Menu Toggle
const menuToggle = document.querySelector(".menu-toggle");
const navLinks = document.querySelector(".nav-links");

if (menuToggle) {
  menuToggle.addEventListener("click", () => {
    navLinks.classList.toggle("active");
  });
}

// Theme Switcher
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

// Typing Effect
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
    // Current index of word
    const current = this.wordIndex % this.words.length;
    // Get full text of current word
    const fullTxt = this.words[current];

    // Check if deleting
    if (this.isDeleting) {
      // Remove char
      this.txt = fullTxt.substring(0, this.txt.length - 1);
    } else {
      // Add char
      this.txt = fullTxt.substring(0, this.txt.length + 1);
    }

    // Insert txt into element
    this.txtElement.innerHTML = `<span class="txt">${this.txt}</span>`;

    // Initial Type Speed
    let typeSpeed = 200;

    if (this.isDeleting) {
      typeSpeed /= 2;
    }

    // If word is complete
    if (!this.isDeleting && this.txt === fullTxt) {
      // Make pause at end
      typeSpeed = this.wait;
      // Set delete to true
      this.isDeleting = true;
    } else if (this.isDeleting && this.txt === "") {
      this.isDeleting = false;
      // Move to next word
      this.wordIndex++;
      // Pause before start typing
      typeSpeed = 500;
    }

    setTimeout(() => this.type(), typeSpeed);
  }
}

// Init On DOM Load
document.addEventListener("DOMContentLoaded", init);

function init() {
  const txtElement = document.querySelector(".txt-type");
  if (txtElement) {
    const words = JSON.parse(txtElement.getAttribute("data-words"));
    const wait = txtElement.getAttribute("data-wait");
    new TypeWriter(txtElement, words, wait);
  }
}

// Portfolio Modal
const modal = document.getElementById("portfolio-modal");
const modalImg = document.querySelector(".modal-img");
const modalTitle = document.querySelector(".modal-title");
const modalText = document.querySelector(".modal-text");
const modalLink = document.querySelector(".modal-link");
const closeBtn = document.querySelector(".close-modal");
const portfolioItems = document.querySelectorAll(".portfolio-item");

portfolioItems.forEach((item) => {
  item.addEventListener("click", () => {
    const img = item.querySelector("img").src;
    const title = item.getAttribute("data-title");
    const desc = item.getAttribute("data-desc");
    const url = item.getAttribute("data-url");

    modalImg.src = img;
    modalTitle.innerText = title;
    modalText.innerText = desc;

    if (url) {
      modalLink.href = url;
      modalLink.style.display = "inline-block";
    } else {
      modalLink.style.display = "none";
    }

    modal.style.display = "block";
    document.body.style.overflow = "hidden"; // Disable background scrolling
  });
});

// Close Modal
if (closeBtn) {
  closeBtn.addEventListener("click", () => {
    modal.style.display = "none";
    document.body.style.overflow = "auto"; // Enable background scrolling
  });
}

window.addEventListener("click", (e) => {
  if (e.target === modal) {
    modal.style.display = "none";
    document.body.style.overflow = "auto";
  }
});
