(function initLoginNature() {

  function setup() {

    const screen = document.getElementById("loginScreen");
    if (!screen) return;

    const stars = document.createElement("div");
    stars.className = "login-stars";

    screen.prepend(stars);

    for(let i=0;i<80;i++){

      const star=document.createElement("span");

      star.className="login-star";

      star.style.left=Math.random()*100+"%";
      star.style.top=Math.random()*100+"%";

      star.style.animationDelay=
          Math.random()*5+"s";

      stars.appendChild(star);
    }

  }

  if(document.readyState==="loading"){
      document.addEventListener("DOMContentLoaded",setup);
  }else{
      setup();
  }

})();