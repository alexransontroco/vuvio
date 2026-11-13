
(function(){
  const W=1600,H=900,GAP=24;
  function fit(){
    if(window.matchMedia('print').matches) return;
    const scale=Math.min((window.innerWidth-20)/W,1);
    document.querySelectorAll('.slide').forEach(slide=>{
      slide.style.transformOrigin='top left';
      slide.style.transform=`scale(${scale})`;
      slide.style.marginBottom=`${GAP-H*(1-scale)}px`;
    });
    const deck=document.getElementById('deck');
    if(deck) deck.style.width=`${W*scale}px`;
  }
  window.addEventListener('load',fit);
  window.addEventListener('resize',fit);
})();
