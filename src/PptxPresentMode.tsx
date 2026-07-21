import { useCallback, useEffect, useMemo, useState } from 'react';
import { SLIDE_HEIGHT_PX, SLIDE_WIDTH_PX, type Presentation, type Slide, type SlideElement } from './lib/pptxModel';
import './PptxPresentMode.css';

interface PptxPresentModeProps {
  presentation: Presentation;
  startIndex: number;
  onExit: () => void;
}

function animatedElements(slide: Slide): SlideElement[] {
  return slide.elements.filter((el) => el.animation && el.animation !== 'none');
}

/**
 * Fullscreen "播放" (present) mode — a rehearsal/preview feature for the
 * slide-transition and element-animation settings. This is intentionally
 * in-app only: real PowerPoint animation/transition timing lives in
 * `<p:timing>`/`<p:transition>` OOXML that our export library (pptxgenjs)
 * has no support for writing, so none of this is baked into the exported
 * .pptx — opening it in real PowerPoint/WPS shows every element statically
 * in place, same as any other basic-tier limitation this project documents
 * honestly rather than fakes. What you see here is what "播放" inside this
 * app itself looks like.
 */
export function PptxPresentMode({ presentation, startIndex, onExit }: PptxPresentModeProps) {
  const [slideIndex, setSlideIndex] = useState(startIndex);
  const [revealCount, setRevealCount] = useState(0);
  const [scale, setScale] = useState(1);

  const slide = presentation.slides[slideIndex];
  const animated = useMemo(() => (slide ? animatedElements(slide) : []), [slide]);

  useEffect(() => {
    const update = () => {
      const availW = window.innerWidth - 80;
      const availH = window.innerHeight - 80;
      setScale(Math.min(availW / SLIDE_WIDTH_PX, availH / SLIDE_HEIGHT_PX, 1.6));
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const goForward = useCallback(() => {
    if (revealCount < animated.length) {
      setRevealCount((c) => c + 1);
      return;
    }
    setSlideIndex((i) => {
      const next = Math.min(i + 1, presentation.slides.length - 1);
      return next;
    });
    setRevealCount(0);
  }, [revealCount, animated.length, presentation.slides.length]);

  const goBack = useCallback(() => {
    if (revealCount > 0) {
      setRevealCount(0);
      return;
    }
    const prev = Math.max(slideIndex - 1, 0);
    const prevSlide = presentation.slides[prev];
    setSlideIndex(prev);
    setRevealCount(prevSlide ? animatedElements(prevSlide).length : 0);
  }, [revealCount, slideIndex, presentation.slides]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onExit();
      } else if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        goForward();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goBack();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [goForward, goBack, onExit]);

  if (!slide) return null;

  const transitionClass = `present-slide--${slide.transition && slide.transition !== 'none' ? slide.transition : 'none'}`;

  return (
    <div className="pptx-present" onClick={goForward}>
      <button
        type="button"
        className="pptx-present__exit"
        onClick={(e) => {
          e.stopPropagation();
          onExit();
        }}
        title="退出播放（Esc）"
      >
        ✕ 退出播放
      </button>
      {/*
        Two nested wrappers, not one, so the "fit the viewport" scale and the
        "play a transition animation" transform never fight over the same
        CSS property: the outer wrapper holds a stable, un-animated
        `transform: scale(...)`, while only the inner (re-keyed per slide) is
        what the CSS transition keyframes animate.
      */}
      <div
        className="pptx-present__scale-wrap"
        style={{ width: SLIDE_WIDTH_PX, height: SLIDE_HEIGHT_PX, transform: `scale(${scale})` }}
      >
        <div
          key={`${slideIndex}-${slide.transition ?? 'none'}`}
          className={`pptx-present__slide ${transitionClass}`}
          style={{
            width: SLIDE_WIDTH_PX,
            height: SLIDE_HEIGHT_PX,
            background: slide.background,
          }}
        >
        {slide.elements.map((el) => {
          const animIndex = animated.indexOf(el);
          const isAnimated = animIndex !== -1;
          const revealed = !isAnimated || animIndex < revealCount;
          const justRevealed = isAnimated && animIndex === revealCount - 1;
          const animClass = justRevealed && el.animation ? `present-anim--${el.animation}` : '';
          return (
            <div
              key={el.id}
              className={`present-el ${animClass}`}
              style={{
                position: 'absolute',
                left: el.x,
                top: el.y,
                width: el.width,
                height: el.height,
                visibility: revealed ? 'visible' : 'hidden',
              }}
            >
              {el.type === 'text' && (
                <div
                  style={{
                    fontSize: el.fontSize,
                    color: el.color,
                    fontWeight: el.bold ? 700 : 400,
                    fontStyle: el.italic ? 'italic' : 'normal',
                    textDecoration: el.underline ? 'underline' : 'none',
                    textAlign: el.align,
                    fontFamily: el.fontFace,
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {el.text}
                </div>
              )}
              {el.type === 'image' && (
                <img src={el.src} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              )}
              {el.type === 'shape' && (
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    background: el.fill,
                    borderRadius: el.shapeKind === 'ellipse' ? '50%' : 0,
                  }}
                />
              )}
              {el.type === 'table' && (
                <table className="present-table">
                  <tbody>
                    {el.cells.map((row, r) => (
                      <tr key={r}>
                        {row.map((cellText, c) => (
                          <td key={c} style={{ fontSize: el.fontSize }}>
                            {cellText}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          );
        })}
        </div>
      </div>
      <div className="pptx-present__hint">
        {slideIndex + 1} / {presentation.slides.length} — 点击 / → 继续，← 返回，Esc 退出
      </div>
    </div>
  );
}
