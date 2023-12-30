import './guify.min.js'

const TITLE = 'The Jiggler!'

const PARAM_DEFS = [
  {
    key: 'image_src_type',
    label: 'image source',
    type: 'select',
    opts: {
      options: ['url', 'file'],
    },
    gen_default: () => 'url',
  },
  {
    key: 'image_src',
    label: 'image URL',
    gen_default: () => 'https://upload.wikimedia.org/wikipedia/commons/b/bb/Jello_Cubes.jpg',
  },
  {
    key: 'image_file',
    label: 'image file',
    type: 'file',
    unhashable: true,
    parser: raw => {
      function dataURItoBlob(dataURI) {
        const byteString = atob(dataURI.split(',')[1])
        const mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0]
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab)
        for (var i = 0; i < byteString.length; i++) {
          ia[i] = byteString.charCodeAt(i)
        }
        return new Blob([ab], { type: mimeString })
      }
      const blob = dataURItoBlob(raw)
      blob.id = Math.random()
      return blob
    },
  },
  {
    key: 'turbulence_frequency',
    type: 'range',
    opts: {
      min: 1,
      max: 100,
      scale: 'log',
    },
    gen_default: () => 2,
    parser: raw => parseFloat(raw, 10),
  },
  {
    key: 'turbulence_type',
    type: 'select',
    opts: {
      options: ['fractalNoise', 'turbulence'],
    },
    gen_default: () => 'fractalNoise',
  },
  {
    key: 'displacement',
    type: 'range',
    opts: {
      min: 1,
      max: 100,
      scale: 'log',
    },
    gen_default: () => 10,
    parser: raw => parseFloat(raw, 10),
  },
  {
    key: 'random_seed',
    type: 'range',
    opts: {
      min: 0,
      max: 1e6,
      step: 1,
      precision: 0,
    },
    gen_default: () => 1,
    parser: raw => parseInt(raw, 10),
  },
]

const IMAGE_CACHE = {}

async function main() {
  create_element({
    tag: 'title',
    parent: document.head,
  }).innerHTML = TITLE
  const state = {
    params: Object.assign({}, gen_default_params(), get_hash_params()),
  }
  const debounced_set_hash_params = debounce(set_hash_params, 5e2)
  state.update_params = (updates) => {
    state.params = Object.assign({}, state.params, updates)
    const hashable_params = {}
    for (const param_def of PARAM_DEFS) {
      const value = state.params[param_def.key]
      if (value === undefined) { continue }
      if (param_def.unhashable) { continue }
      hashable_params[param_def.key] = value
    }
    debounced_set_hash_params(hashable_params)
  }
  const ui = create_ui({ state })
  await render({ ui, state })
}

function gen_default_params() {
  const default_params = {}
  for (const param_def of PARAM_DEFS) {
    const default_value = param_def.gen_default?.()
    if (default_value !== undefined) {
      default_params[param_def.key] = default_value
    }
  }
  return default_params
}

function get_hash_params() {
  const parsed_hash_params = {}
  const raw_hash_params = get_raw_hash_params()
  for (const param_def of PARAM_DEFS) {
    const raw_value = raw_hash_params[param_def.key]
    if (raw_value === undefined) { continue }
    const parsed_value = param_def.parser?.(raw_value) ?? raw_value
    parsed_hash_params[param_def.key] = parsed_value
  }
  return parsed_hash_params
}

function get_raw_hash_params() {
  return Object.fromEntries(new URLSearchParams(window.location.hash.substring(1)).entries())
}

function set_hash_params(params) {
  const search_params = new URLSearchParams(params)
  window.location.hash = search_params.toString()
}

function debounce(func, delay, { leading } = {}) {
  let timerId
  function debounced_func(...args) {
    if (!timerId && leading) {
      func(...args)
    }
    clearTimeout(timerId)
    timerId = setTimeout(() => func(...args), delay)
  }
  return debounced_func
}

function create_ui({ state }) {
  const ui = {}

  ui.container = create_element({
    attributes: { id: 'container' },
    styles: {
      height: '100vh',
      width: '100vw',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: 'hsl(0, 0%, 50%)',
      backgroundImage: 'radial-gradient(hsl(0, 0%, 30%) 0.5px, transparent 0.5px), radial-gradient(hsl(0, 0%, 40%) 0.5px, hsl(0, 0%, 50%) 0.5px)',
      backgroundSize: '20px 20px',
      backgroundPosition: '0 0,10px 10px',
    },
  })

  ui.gui = new guify({
    title: `<span>${TITLE}(<a style="color: inherit" href="https://github.com/adorsk/scrambler/" target="_blank">ABOUT</a>) <a style="color: inherit" href="https://forms.gle/sPG8z2z9oY3dgSr86" target="_blank">(Guestbook)</a></span>`,
    open: true,
  })
  for (const param_def of PARAM_DEFS) {
    ui[param_def.key] = ui.gui.Register({
      type: param_def.type ?? 'text',
      label: param_def.label ?? param_def.key,
      initial: state.params[param_def.key] ?? '',
      onChange(raw) {
        state.update_params({
          [param_def.key]: param_def.parser?.(raw) ?? raw
        })
        render({ ui, state })
      },
      ...(param_def.opts ?? {}),
    })
  }

  let animating = false
  function frame() {
    if (!animating) { return }
    // Increment random seed.
    ui.random_seed.SetValue((state.params.random_seed + 1) % ui.random_seed.opts.max)
    ui.random_seed.opts.onChange(ui.random_seed.GetValue())
    requestAnimationFrame(frame)
  }
  ui.gui.Register({
    type: 'button',
    label: 'jiggle it!',
    action() {
      animating = !animating
      state.params.random_seed = 0
      requestAnimationFrame(frame)
    },
  })

  ui.images_container = create_element({
    parent: ui.container,
    styles: {
      flexGrow: 1,
      minHeight: 0,
      display: 'flex',
      position: 'relative',
      padding: '4px',
    },
  })

  ui.input_canvas = create_element({
    tag: 'canvas',
    attributes: { id: 'input_canvas' },
    parent: ui.images_container,
    styles: {
      position: 'absolute',
      top: '40px',
      right: '40px',
      maxWidth: '60px',
      maxHeight: '60px',
      border: 'thin solid hsla(0, 0%, 20%, 0.5)',
    },
  })

  ui.output_canvas = create_element({
    tag: 'canvas',
    attributes: { id: 'output_canvas' },
    parent: ui.images_container,
    styles: {
      maxWidth: '100%',
      maxHeight: '100%',
      margin: '0 auto',
      objectFit: 'contain',
      border: 'thin solid hsla(0, 0%, 20%, 0.5)',
    },
  })

  ui.filter_container = create_element({
    tag: 'svg',
    namespace: 'http://www.w3.org/2000/svg',
    parent: ui.container,
    styles: {
      position: 'absolute',
    },
    attributes: { width: 0, height: 0 },
  })
  ui.filter_container.innerHTML = (`
<defs>
<filter id="FILTER">
<feTurbulence type="fractalNoise" baseFrequency="0.001" numOctaves="2"/>
<feDisplacementMap xChannelSelector="R" yChannelSelector="G" in="SourceGraphic" scale="25" />
</filter>
</defs>
`)
  ui.filter = ui.filter_container.getElementsByTagName('filter')[0]
  ui.feTurbulence = ui.filter.getElementsByTagName('feTurbulence')[0]
  ui.feDisplacementMap = ui.filter.getElementsByTagName('feDisplacementMap')[0]
  return ui
}

function create_element({
  tag = 'div',
  namespace,
  attributes,
  parent = document.body,
  styles,
} = {}) {
  const element = namespace ? document.createElementNS(namespace, tag) : document.createElement(tag)
  for (const [key, value] of Object.entries(attributes ?? {})) {
    element.setAttribute(key, value)
  }
  if (styles) { Object.assign(element.style, styles) }
  if (parent) { parent.appendChild(element) }
  return element
}

async function render({ ui, state }) {
  const { params } = state
  const image = await load_image({ ui, params })
  draw_image_to_ctx({
    image,
    ctx: ui.input_canvas.getContext('2d'),
  })
  render_output_image({
    input_image: image,
    ui,
    params,
  })
}

async function load_image({ ui, params }) {
  const { image_src_type } = params
  let cache_key
  let get_src
  if (image_src_type === 'url') {
    cache_key = params.image_src
    get_src = () => params.image_src
  } else if (image_src_type === 'file') {
    cache_key = `FILE:${params.image_file?.id}`
    get_src = () => {
      if (!params.image_file) {
        throw new Error('No file provided yet')
      }
      return URL.createObjectURL(params.image_file)
    }
  }
  if (!IMAGE_CACHE[cache_key]) {
    IMAGE_CACHE[cache_key] = new Promise((resolve, reject) => {
      ui.gui.Toast('Loading...', 1e3, 1e3)
      try {
        const image = new Image()
        image.onload = () => resolve(image)
        image.onerror = reject
        image.crossOrigin = 'anonymous'
        image.src = get_src()
        ui.gui.Toast('Loaded!', 1e3, 1e3)
      } catch (error) {
        ui.gui.Toast(`ERROR: ${error.message}`)
        reject(error)
      }
    })
  }
  return IMAGE_CACHE[cache_key]
}

function draw_image_to_ctx({ image, ctx }) {
  ctx.canvas.height = image.height
  ctx.canvas.width = image.width
  ctx.drawImage(image, 0, 0)
}

function render_output_image({
  input_image,
  ui,
  params,
}) {
  const prng = gen_pseudo_random_number_generator(params.random_seed)
  const ctx = ui.output_canvas.getContext('2d')
  ctx.canvas.height = input_image.height
  ctx.canvas.width = input_image.width
  ui.feTurbulence.setAttribute('type', params.turbulence_type)
  ui.feTurbulence.setAttribute('baseFrequency', (1e-2 * params.turbulence_frequency) * prng())
  ui.feDisplacementMap.setAttribute('scale', params.displacement)
  ui.feDisplacementMap.setAttribute('seed', params.random_seed)
  ctx.filter = `url(#${ui.filter.id})`
  ctx.canvas.style.filter = `url(#${ui.filter.id})`
  ctx.drawImage(input_image, 0, 0)
}

function gen_pseudo_random_number_generator(seed) {
  function mulberry32_prng() {
    var t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1)
    t ^= t + Math.imul(t ^ t >>> 7, t | 61)
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
  return mulberry32_prng
}


main().catch(err => console.error(err))


