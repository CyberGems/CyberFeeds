;(function () {
  var bgs = {
    dark: '#0d1117',
    grayscale: '#18181b',
    light: '#f6f8fa'
  }
  var theme = 'dark'
  try {
    theme = localStorage.getItem('cyberfeeds-theme') || 'dark'
  } catch (e) {
    /* ignore */
  }
  if (!bgs[theme]) {
    theme = 'dark'
  }
  var bg = bgs[theme]
  document.documentElement.setAttribute('data-theme', theme)
  document.documentElement.style.backgroundColor = bg
  document.documentElement.style.colorScheme = theme === 'light' ? 'light' : 'dark'
})()
