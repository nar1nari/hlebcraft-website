function applyMouseParallax(element, options = {}) {
  const {
    strength = 20,
    scale = 1.05
  } = options

  function handleMouseMove(e) {
    const x = e.clientX / window.innerWidth - 0.5
    const y = e.clientY / window.innerHeight - 0.5

    const transform = `translate(${x * strength}px, ${y * strength}px) scale(${scale})`
    element.style.transform = transform
  }

  function reset() {
    element.style.transform = `translate(0, 0) scale(${scale})`
  }

  reset()

  window.addEventListener('mousemove', handleMouseMove)
  window.addEventListener('mouseleave', reset)

  return () => {
    window.removeEventListener('mousemove', handleMouseMove)
    window.removeEventListener('mouseleave', reset)
  }
}

const l0 = document.getElementById('thumb_l0')
const l1 = document.getElementById('thumb_l1')
const l2 = document.getElementById('thumb_l2')
const l3 = document.getElementById('thumb_l3')

applyMouseParallax(l0, { strength: 5 })
applyMouseParallax(l1, { strength: 10 })
applyMouseParallax(l2, { strength: 15 })
applyMouseParallax(l3, { strength: 20 })
