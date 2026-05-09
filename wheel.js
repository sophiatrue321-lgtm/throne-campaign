/* ============================================================
   THRONE CAMPAIGN — Wheel
   
   States:
     loading -> ready -> spinning -> result
   Or for already-spun token:
     loading -> result (with previous result data)
   Or for not-yet-approved token:
     loading -> not-ready
   ============================================================ */

(function() {
  'use strict';
  
  const config = window.THRONE_CONFIG;
  const supabase = window.supabase.createClient(
    config.SUPABASE_URL,
    config.SUPABASE_ANON_KEY
  );
  
  // Brand palette for wheel segments
  const SEGMENT_COLOURS = [
    { fill: '#8b1d3b', text: '#f5d76e' }, // burgundy / pale gold
    { fill: '#3d0f1c', text: '#e8c547' }, // bordeaux / bright gold
    { fill: '#6b1a30', text: '#f4ebd4' }, // wine rich / cream
    { fill: '#4a1424', text: '#d4a017' }, // wine / rich gold
    { fill: '#a82649', text: '#f4ebd4' }, // burgundy glow / cream
    { fill: '#2a0a13', text: '#f5d76e' }, // wine deep / pale gold
    { fill: '#8b1d3b', text: '#e8c547' }, // burgundy / bright gold
    { fill: '#3d0f1c', text: '#f4ebd4' }, // bordeaux / cream
  ];
  
  let state = {
    token: null,
    items: [],
  };
  
  /* --- Helpers ------------------------------------------------- */
  
  function getToken() {
    return new URLSearchParams(window.location.search).get('token');
  }
  
  function showState(stateId) {
    const ids = ['loading-state', 'invalid-state', 'not-ready-state', 'ready-state', 'spinning-state', 'result-state'];
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.hidden = id !== stateId;
    });
  }
  
  function formatGBP(amount) {
    const num = Number(amount) || 0;
    return '£' + num.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }
  
  /* --- Wheel SVG generation ------------------------------------ */
  
  function buildWheelSVG(items, targetEl) {
    const size = 480;
    const cx = size / 2;
    const cy = size / 2;
    const r = size / 2 - 4;
    const segCount = items.length;
    const segAngle = (2 * Math.PI) / segCount;
    
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    
    items.forEach((item, idx) => {
      const startAngle = -Math.PI / 2 + segAngle * idx;
      const endAngle = startAngle + segAngle;
      const colour = SEGMENT_COLOURS[idx % SEGMENT_COLOURS.length];
      
      // Pie slice path
      const x1 = cx + r * Math.cos(startAngle);
      const y1 = cy + r * Math.sin(startAngle);
      const x2 = cx + r * Math.cos(endAngle);
      const y2 = cy + r * Math.sin(endAngle);
      const largeArc = segAngle > Math.PI ? 1 : 0;
      
      const pathData = [
        `M ${cx} ${cy}`,
        `L ${x1} ${y1}`,
        `A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`,
        'Z',
      ].join(' ');
      
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', pathData);
      path.setAttribute('fill', colour.fill);
      path.setAttribute('stroke', '#d4a017');
      path.setAttribute('stroke-width', '1.5');
      svg.appendChild(path);
      
      // Item label - placed along the radial centre of segment
      const labelAngle = startAngle + segAngle / 2;
      const labelRadius = r * 0.65;
      const lx = cx + labelRadius * Math.cos(labelAngle);
      const ly = cy + labelRadius * Math.sin(labelAngle);
      
      // Rotate text so it reads outward
      const rotateDeg = (labelAngle * 180) / Math.PI + 90;
      
      const textWrapper = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      textWrapper.setAttribute('transform', `translate(${lx}, ${ly}) rotate(${rotateDeg})`);
      
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('dominant-baseline', 'middle');
      text.setAttribute('font-family', 'Cinzel, serif');
      text.setAttribute('font-size', '15');
      text.setAttribute('font-weight', '600');
      text.setAttribute('letter-spacing', '1');
      text.setAttribute('fill', colour.text);
      
      // Split long names into two lines
      const words = item.display_name.split(' ');
      if (words.length > 1) {
        words.forEach((word, i) => {
          const tspan = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
          tspan.setAttribute('x', '0');
          tspan.setAttribute('dy', i === 0 ? '-0.4em' : '1.1em');
          tspan.textContent = word;
          text.appendChild(tspan);
        });
      } else {
        text.textContent = item.display_name;
      }
      
      textWrapper.appendChild(text);
      svg.appendChild(textWrapper);
    });
    
    targetEl.innerHTML = '';
    targetEl.appendChild(svg);
  }
  
  /* --- Spin animation ------------------------------------------ */
  
  function spinWheelToTarget(wheelEl, targetItemIndex, totalItems) {
    return new Promise((resolve) => {
      const segAngle = 360 / totalItems;
      // The pointer is at top (12 o'clock). Segments start at -90 degrees.
      // To land segment N under pointer, wheel must rotate so segment N's centre is at top.
      // Segment N's centre is at angle (segAngle * N) + (segAngle / 2), measured from start (top).
      // We need to rotate wheel by negative of that, plus full spins for drama.
      const segmentCentreFromTop = (segAngle * targetItemIndex) + (segAngle / 2);
      const fullSpins = 6; // 6 full rotations for drama
      const finalRotation = (fullSpins * 360) - segmentCentreFromTop;
      
      // Apply rotation
      wheelEl.style.transition = 'transform 5s cubic-bezier(0.15, 0.85, 0.25, 1)';
      wheelEl.style.transform = `rotate(${finalRotation}deg)`;
      
      // Wait for animation to complete
      setTimeout(resolve, 5100);
    });
  }
  
  /* --- Render: result page ------------------------------------- */
  
  function renderResult(result, isFreshSpin) {
    const eyebrowEl = document.getElementById('result-eyebrow');
    const nameEl = document.getElementById('result-item-name');
    const descEl = document.getElementById('result-item-description');
    const handleEl = document.getElementById('result-handle');
    const amountEl = document.getElementById('result-amount');
    const altarStatusEl = document.getElementById('result-altar-status');
    const throneLink = document.getElementById('result-throne-link');
    
    eyebrowEl.textContent = isFreshSpin ? 'Goddess Has Decided' : 'Your Decree';
    nameEl.textContent = result.item_display_name;
    descEl.textContent = result.item_description || '';
    handleEl.textContent = result.sub_handle;
    amountEl.textContent = formatGBP(result.tribute_amount);
    
    if (result.is_already_funded) {
      altarStatusEl.textContent = 'Fully Funded ✦';
      altarStatusEl.style.color = '#e8c547';
    } else {
      const remaining = Number(result.item_goal_amount) - Number(result.item_raised_amount);
      altarStatusEl.textContent = formatGBP(remaining) + ' to fill';
    }
    
    // Throne link
    if (result.item_throne_url) {
      throneLink.href = result.item_throne_url;
    } else {
      throneLink.style.opacity = '0.5';
      throneLink.style.pointerEvents = 'none';
      throneLink.querySelector('span').textContent = 'Throne Link Coming Soon';
    }
    
    // Twitter share
    const shareText = `Goddess @SophiaTruee has decreed: I shall fund Her ${result.item_display_name} 👑`;
    const shareUrl = window.location.origin + window.location.pathname.replace('wheel.html', '');
    document.getElementById('share-twitter').href = 
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
    
    // Copy campaign link
    document.getElementById('copy-link-btn').addEventListener('click', async (e) => {
      e.preventDefault();
      const btn = e.currentTarget;
      try {
        await navigator.clipboard.writeText(shareUrl);
        btn.classList.add('copied');
        btn.textContent = '✓ Copied';
        setTimeout(() => {
          btn.classList.remove('copied');
          btn.textContent = 'Copy Campaign Link';
        }, 2000);
      } catch (err) {
        console.error('Copy failed:', err);
      }
    });
    
    // Clear localStorage token now that they've spun
    try {
      localStorage.removeItem('throne_spin_token');
    } catch (e) { /* ignore */ }
    
    showState('result-state');
  }
  
  /* --- Boot logic ---------------------------------------------- */
  
  async function boot() {
    state.token = getToken();
    
    if (!state.token) {
      showState('invalid-state');
      return;
    }
    
    // First, check the claim status by token
    try {
      const { data: claimRows, error: claimErr } = await supabase.rpc('get_claim_by_token', {
        claim_token: state.token,
      });
      
      if (claimErr) throw claimErr;
      
      const claim = Array.isArray(claimRows) && claimRows.length > 0 ? claimRows[0] : null;
      
      if (!claim) {
        showState('invalid-state');
        return;
      }
      
      if (claim.status === 'rejected') {
        showState('invalid-state');
        return;
      }
      
      if (claim.status !== 'approved') {
        showState('not-ready-state');
        return;
      }
      
      // If already spun, show the previous result
      if (claim.spin_used) {
        const { data: resultRows, error: resErr } = await supabase.rpc('get_spin_result', {
          claim_token: state.token,
        });
        
        if (resErr) throw resErr;
        
        const result = Array.isArray(resultRows) && resultRows.length > 0 ? resultRows[0] : null;
        if (!result) {
          showState('invalid-state');
          return;
        }
        
        renderResult(result, false);
        return;
      }
      
      // Approved + not yet spun = ready to spin
      // Load items to build the wheel
      const { data: items, error: itemsErr } = await supabase
        .from('public_items')
        .select('*')
        .order('display_order');
      
      if (itemsErr) throw itemsErr;
      
      state.items = items;
      
      // Build the wheel in both ready & spinning states
      buildWheelSVG(items, document.getElementById('wheel'));
      buildWheelSVG(items, document.getElementById('wheel-spinning'));
      
      showState('ready-state');
      
      // Wire spin button
      document.getElementById('spin-button').addEventListener('click', performSpin);
      
    } catch (err) {
      console.error('Boot error:', err);
      showState('invalid-state');
    }
  }
  
  /* --- Perform spin -------------------------------------------- */
  
  async function performSpin() {
    const btn = document.getElementById('spin-button');
    btn.disabled = true;
    
    try {
      // Call the server-side spin function — it picks the item and marks used atomically
      const { data: spinRows, error: spinErr } = await supabase.rpc('perform_spin', {
        claim_token: state.token,
      });
      
      if (spinErr) throw spinErr;
      
      const result = Array.isArray(spinRows) && spinRows.length > 0 ? spinRows[0] : null;
      if (!result) throw new Error('No result returned');
      
      // Find the index of the chosen item in our wheel
      const targetIndex = state.items.findIndex(i => i.id === result.item_id);
      if (targetIndex === -1) {
        // Shouldn't happen, but handle gracefully
        renderResult(result, true);
        return;
      }
      
      // Switch to spinning state
      showState('spinning-state');
      
      // Wait a beat for atmosphere
      await new Promise(r => setTimeout(r, 800));
      
      // Stop the eternal-spin animation, then animate to the target
      const spinningWheel = document.getElementById('wheel-spinning');
      spinningWheel.classList.remove('wheel--spinning');
      spinningWheel.style.transform = 'rotate(0deg)';
      // Force reflow so the next transform animates
      spinningWheel.offsetWidth;
      
      await spinWheelToTarget(spinningWheel, targetIndex, state.items.length);
      
      // Brief pause before showing result
      await new Promise(r => setTimeout(r, 600));
      
      renderResult(result, true);
      
    } catch (err) {
      console.error('Spin failed:', err);
      btn.disabled = false;
      // Could show an error state here
      alert('The throne could not process your spin: ' + (err.message || 'Unknown error'));
    }
  }
  
  /* --- Boot ---------------------------------------------------- */
  
  boot();
})();
