/* ============================================================
   THRONE CAMPAIGN — Main App
   
   Reads from public Supabase views (no sensitive data exposed):
   - public_items (8 items with goals & raised amounts)
   - public_totals (campaign-wide aggregates)
   ============================================================ */

(function() {
  'use strict';
  
  const config = window.THRONE_CONFIG;
  const supabase = window.supabase.createClient(
    config.SUPABASE_URL,
    config.SUPABASE_ANON_KEY
  );
  
  /* --- Format helpers ----------------------------------------- */
  
  function formatGBP(amount) {
    const num = Number(amount) || 0;
    return '£' + num.toLocaleString('en-GB', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  }
  
  function pad2(n) {
    return String(n).padStart(2, '0');
  }
  
  /* --- Render: total raised section ---------------------------- */
  
  async function renderTotals() {
    const { data, error } = await supabase
      .from('public_totals')
      .select('*')
      .single();
    
    if (error) {
      console.error('Failed to load totals:', error);
      return;
    }
    
    const raised = Number(data.total_raised) || 0;
    const goal = Number(data.total_goal) || 0;
    const pct = Number(data.overall_percentage) || 0;
    
    document.getElementById('total-raised').textContent = formatGBP(raised);
    document.getElementById('total-goal').textContent = formatGBP(goal);
    document.getElementById('total-percentage').textContent = pct.toFixed(1);
    
    // Animate the bar after a brief delay so the user sees it grow
    setTimeout(() => {
      const fill = document.getElementById('total-bar');
      fill.style.width = Math.min(100, pct) + '%';
    }, 400);
  }
  
  /* --- Render: tributer count (spectator counter) -------------- */
  
  async function renderTributerStats() {
    const { data, error } = await supabase
      .from('public_tribute_stats')
      .select('*')
      .single();
    
    if (error) {
      console.error('Failed to load tributer stats:', error);
      return;
    }
    
    const count = Number(data.total_tributers) || 0;
    document.getElementById('tributer-count').textContent = count.toLocaleString('en-GB');
  }
  
  /* --- Render: items grid -------------------------------------- */
  
  async function renderItems() {
    const grid = document.getElementById('items-grid');
    
    const { data, error } = await supabase
      .from('public_items')
      .select('*')
      .order('display_order');
    
    if (error) {
      console.error('Failed to load items:', error);
      grid.innerHTML = '<div class="items__loading">The throne is resting. Try again shortly.</div>';
      return;
    }
    
    if (!data || data.length === 0) {
      grid.innerHTML = '<div class="items__loading">No altars yet.</div>';
      return;
    }
    
    grid.innerHTML = '';
    
    data.forEach((item, idx) => {
      const raised = Number(item.raised_amount) || 0;
      const goal = Number(item.goal_amount) || 0;
      const pct = Number(item.percentage_funded) || 0;
      const funded = pct >= 100;
      
      const card = document.createElement('article');
      card.className = 'item' + (funded ? ' item--funded' : '');
      card.style.animationDelay = (idx * 80) + 'ms';
      card.innerHTML = `
        <p class="item__rank">${pad2(idx + 1)} · Altar</p>
        <h3 class="item__name">${item.display_name}</h3>
        <p class="item__description">${item.description || ''}</p>
        <div class="item__progress">
          <span class="item__raised">${formatGBP(raised)}</span>
          <span class="item__goal">/ ${formatGBP(goal)}</span>
        </div>
        <div class="item__bar">
          <div class="item__bar-fill" data-pct="${pct}"></div>
        </div>
        <p class="item__percentage">
          ${funded ? '✦ Fully Funded ✦' : pct.toFixed(1) + '% claimed'}
        </p>
      `;
      
      grid.appendChild(card);
    });
    
    // Animate the bars after they're in the DOM
    setTimeout(() => {
      document.querySelectorAll('.item__bar-fill').forEach((fill) => {
        const pct = Number(fill.dataset.pct) || 0;
        fill.style.width = Math.min(100, pct) + '%';
      });
    }, 600);
  }
  
  /* --- Wire up tribute platform links -------------------------- */
  
  function wirePlatformLinks() {
    document.querySelectorAll('.tribute__platform').forEach((link) => {
      const platform = link.dataset.platform;
      const url = config.PLATFORMS[platform];
      if (url && url !== '#') {
        link.href = url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
      }
    });
  }
  
  /* --- Check for pending spin in localStorage ------------------ */
  
  function checkPendingSpin() {
    try {
      const token = localStorage.getItem('throne_spin_token');
      if (!token) return;
      
      // Show a discreet "resume" banner
      const banner = document.createElement('div');
      banner.className = 'resume-banner';
      banner.innerHTML = `
        <span>You have a pending spin from your last visit.</span>
        <a href="spin.html?token=${encodeURIComponent(token)}">Resume →</a>
      `;
      document.body.insertBefore(banner, document.body.firstChild);
    } catch (e) {
      // localStorage might be disabled
    }
  }
  
  /* --- Boot ---------------------------------------------------- */
  
  async function boot() {
    wirePlatformLinks();
    checkPendingSpin();
    
    try {
      // Run all in parallel for speed
      await Promise.all([
        renderTotals(),
        renderItems(),
        renderTributerStats(),
      ]);
    } catch (err) {
      console.error('Boot error:', err);
    }
  }
  
  // Start once DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
