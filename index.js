const sections = document.querySelectorAll('.fade-section'); // ←これを追加
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('fade-in');
      observer.unobserve(entry.target); // 一度フェードインしたら監視を外す
    }
  });
}, { threshold: 0.2 }); // 20%見えたら発火

sections.forEach(section => {
  observer.observe(section);
});