/* ============================================================
   THRONE CAMPAIGN — Spin Page (state-aware)
   ============================================================ */

(function() {
  'use strict';
  
  const config = window.THRONE_CONFIG;
  const supabase = window.supabase.createClient(
    config.SUPABASE_URL,
    config.SUPABASE_ANON_KEY
  );
  
  function getToken() {
    const params = new URLSearchParams(window.location.search);
    return params.get('token');
  }
  
  function showState(stateId) {
    document.querySelectorAll('.form-card').forEach(el => {
      el.hidden = true;
    });
    const target = document.getElementById(stateId);
    if (target) target.hidden = false;
  }
  
  function formatRelativeTime(iso) {
    const date = new Date(iso);
    const diffMs = Date.now() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr} hour${diffHr === 1 ? '' : 's'} ago`;
    const diffDay = Math.floor(diffHr / 24);
    return `${diffDay} day${diffDay === 1 ? '' : 's'} ago`;
  }
  
  async function checkStatus() {
    const token = getToken();
    
    if (!token) {
      showState('invalid-state');
      return;
    }
    
    try {
      const { data, error } = await supabase.rpc('get_claim_by_token', {
        claim_token: token,
      });
      
      if (error) {
        console.error('Check status error:', error);
        showState('invalid-state');
        return;
      }
      
      // RPC returns an array even with one row
      const claim = Array.isArray(data) && data.length > 0 ? data[0] : null;
      
      if (!claim) {
        showState('invalid-state');
        return;
      }
      
      // Save token to localStorage so "resume" works on the main page
      try {
        localStorage.setItem('throne_spin_token', token);
      } catch (e) { /* ignore */ }
      
      if (claim.status === 'rejected') {
        showState('rejected-state');
        return;
      }
      
      if (claim.spin_used) {
        showState('used-state');
        return;
      }
      
      if (claim.status === 'pending') {
        document.getElementById('pending-handle').textContent = claim.sub_handle;
        document.getElementById('pending-amount').textContent = '£' + Number(claim.amount).toLocaleString('en-GB');
        document.getElementById('pending-time').textContent = formatRelativeTime(claim.submitted_at);
        showState('pending-state');
        return;
      }
      
      if (claim.status === 'approved') {
        // Wheel page is in Session 3 - for now just acknowledge readiness
        // We'll wire spin-cta to wheel.html?token=... when wheel is built
        document.getElementById('spin-cta').href = `wheel.html?token=${encodeURIComponent(token)}`;
        showState('ready-state');
        return;
      }
      
      // Fallback
      showState('invalid-state');
      
    } catch (err) {
      console.error('Status check failed:', err);
      showState('invalid-state');
    }
  }
  
  checkStatus();
})();
