class ElementAnimator {
	/**
	 * 初始化动画配置
	 * * @param {Object} options - 动画配置参数
	 * @param {string|HTMLElement|NodeList|Array} options.targets - 目标元素
	 * @param {string|string[]} [options.property='color'] - 要动画的CSS属性
	 * @param {number} [options.speed=0.01] - 动画速度
	 * @param {number} [options.hueTimeFactor=15] - 时间对色调的影响系数
	 * @param {number} [options.hueIndexFactor=10] - 元素/字符索引对色调的影响系数
	 * @param {string} [options.saturation='100%'] - 颜色饱和度
	 * @param {string} [options.lightness='50%'] - 颜色亮度
	 * @param {boolean} [options.splitChars] - 是否拆分文本为单个字符
	 */
	constructor(options) {
		this.options = {
			property: 'color',
			speed: 0.01,
			hueTimeFactor: 15,
			hueIndexFactor: 10,
			saturation: '100%',
			lightness: '50%',
			splitChars: undefined,
			...options
		};
		this.properties = [].concat(this.options.property);
		this.options.splitChars ??= this.properties.includes('color');
		this.targets = this._resolveTargets(this.options.targets);
		if (!this.targets.length) {
			console.warn('未找到目标元素');
			return;
		}
		this.time = 0;
		this.animationId = null;
		this.animatedElements = [];
		this.isVisible = true;
		this._uid = Date.now();
		this._observer = null;
		this._normalizedProps = this.properties.map(p => this._getCssProp(p));
		this._transition = this.properties.map(p => `${p} 1s linear`).join(', ');
		this._initElements();
		this._initObserver();
	}
	_resolveTargets(targets) {
		let elements = [];
		if (typeof targets === 'string') elements = Array.from(document.querySelectorAll(targets));
		else if (targets instanceof HTMLElement) elements = [targets];
		else if (targets instanceof NodeList) elements = Array.from(targets);
		else if (Array.isArray(targets)) elements = targets.flatMap(t => t instanceof HTMLElement ? [t] :
			t instanceof NodeList ? Array.from(t) : []);
		return [...new Set(elements)];
	}
	_getCssProp(prop) {
		const style = document.documentElement.style;
		if (prop in style) return prop;
		const capProp = prop.charAt(0).toUpperCase() + prop.slice(1);
		for (const prefix of ['webkit', 'moz', 'ms', 'o']) {
			const prefixed = prefix + capProp;
			if (prefixed in style) return prefixed;
		}
		return prop;
	}
	_initElements() {
		const {
			splitChars
		} = this.options;
		const charClass = `anim-char-${this._uid}`;
		const propsStr = this.properties.join(', ');
		if (splitChars) {
			this.targets.forEach(el => {
				if (el.querySelector(`.${charClass}`)) return;
				el.dataset.orgContent = el.innerHTML;
				const fragment = document.createDocumentFragment();
				el.textContent.split('').forEach((char, i) => {
					const span = document.createElement('span');
					span.className = charClass;
					span.textContent = char;
					span.style.cssText =
						`font: inherit; display: inline-block; will-change: ${propsStr}, transform; transition: ${this._transition}; transform: translateZ(0);`;
					fragment.appendChild(span);
				});
				el.innerHTML = '';
				el.appendChild(fragment);
			});
			this.animatedElements = Array.from(document.querySelectorAll(`.${charClass}`));
		} else {
			this.animatedElements = this.targets;
			this.animatedElements.forEach(el => {
				el.style.cssText =
					`will-change: ${propsStr}, transform; transition: ${this._transition}; transform: translateZ(0);`;
			});
		}
	}
	_initObserver() {
		if (!('IntersectionObserver' in window)) return;
		this._observer = new IntersectionObserver(entries => {
			const wasVisible = this.isVisible;
			this.isVisible = entries.some(e => e.isIntersecting);
			if (wasVisible !== this.isVisible) {
				this.isVisible ? this.start() : this.stop();
			}
		}, {
			threshold: 0.01
		});
		this.animatedElements.forEach(el => this._observer.observe(el));
	}
	_update() {
		const {
			speed,
			hueTimeFactor,
			hueIndexFactor,
			saturation,
			lightness
		} = this.options;
		this.time += speed;
		const time = this.time;
		this.animatedElements.forEach((el, i) => {
			const hue = (time * hueTimeFactor + i * hueIndexFactor) % 360;
			const color = `hsl(${hue}, ${saturation}, ${lightness})`;
			this._normalizedProps.forEach(prop => el.style[prop] = color);
		});
		this.animationId = this.isVisible ? requestAnimationFrame(() => this._update()) : null;
	}
	start() {
		if (!this.animationId && this.animatedElements.length && this.isVisible) {
			this._update();
		}
	}
	stop() {
		if (this.animationId) {
			cancelAnimationFrame(this.animationId);
			this.animationId = null;
		}
	}
	destroy() {
		this.stop();
		if (this._observer) {
			this.animatedElements.forEach(el => this._observer.unobserve(el));
			this._observer.disconnect();
			this._observer = null;
		}
		const {
			splitChars
		} = this.options;
		if (splitChars) {
			this.targets.forEach(el => {
				if (el.dataset.orgContent) {
					el.innerHTML = el.dataset.orgContent;
					delete el.dataset.orgContent;
				}
			});
		} else {
			this.animatedElements.forEach(el => {
				this._normalizedProps.forEach(prop => el.style[prop] = '');
				el.style.transition = '';
				el.style.willChange = '';
				el.style.transform = '';
			});
		}
		this.animatedElements = null;
		this.targets = null;
		this.options = null;
		this._normalizedProps = null;
	}
}