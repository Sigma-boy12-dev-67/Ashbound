/* ============================================================
   ONLINE SETUP - fill this in once (see ONLINE-SETUP.md).
   Until "enabled" is true and the Firebase values are pasted, the ONLINE CO-OP screen just says it isn't set up
   and the rest of the game works exactly as before.
   These values are NOT secret: Firebase web keys are meant to be public. Safety comes from database.rules.json.
   ============================================================ */
window.AB = window.AB || {};
AB.NETCFG = {
  enabled: true,
  root: 'ashbound',
  firebase: {
    apiKey: 'AIzaSyAeaZOOcgJWer0hVUIBF2H1fWkdCa6D0lg',
    authDomain: 'ashbound-32dcc.firebaseapp.com',
    databaseURL: 'https://ashbound-32dcc-default-rtdb.asia-southeast1.firebasedatabase.app/',
    projectId: 'ashbound-32dcc',
    appId: '1:388544051317:web:620b7c79d810f8c2d4203c'
  }
};