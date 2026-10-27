/* Run before first paint; the animation never waits for a third-party request. */
(function(){
  const root=document.documentElement;
  const reduced=window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const navigation=performance.getEntriesByType?.("navigation")[0];
  let fromThisSite=false;
  try{
    const referrer=new URL(document.referrer);
    const sitePath=new URL(".",location.href).pathname;
    fromThisSite=referrer.origin===location.origin&&referrer.pathname.startsWith(sitePath);
  }catch{} // Direct visits have no referrer.

  // Do not interrupt normal navigation inside the site or browser history.
  const show=!reduced&&navigation?.type!=="back_forward"&&(!fromThisSite||navigation?.type==="reload");
  if(show)root.classList.add("intro-active");

  function cleanUp(){
    root.classList.remove("intro-active");
    document.getElementById("siteIntro")?.remove();
  }
  if(show){
    // CSS also hides the intro on its own, even if this timer cannot run.
    setTimeout(cleanUp,1500);
    window.addEventListener("pageshow",event=>{if(event.persisted)cleanUp()});
  }
  // Remove skipped markup, including when parsing took longer than the safety timer.
  document.addEventListener("DOMContentLoaded",()=>{
    if(!root.classList.contains("intro-active"))cleanUp();
  },{once:true});
})();
