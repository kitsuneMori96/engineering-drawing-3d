import { useEffect, useState } from 'react';
import { clamp } from './math';

/**
 * 数值补间:让 unfold 值在目标之间平滑过渡,得到自动播放的展开动画。
 * 返回当前值(每帧更新),调用方把它喂给渲染即可。
 *
 * target 只会离散地变化(讲解步骤 / 拖动滑杆),因此 effect 每次启动时
 * 从"当前值"出发向 target 补间,而不是重置到 0——避免跳变。
 */
export function useTween(target: number, speed = 2.6, enabled = true): number {
  const [value, setValue] = useState(target);

  useEffect(() => {
    if (!enabled) {
      setValue(target);
      return;
    }
    let raf = 0;
    let last = performance.now();
    // 用函数式更新读取"最新值",无需 ref,也就不违反 refs 规则
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      let done = false;
      setValue((cur) => {
        const d = target - cur;
        if (Math.abs(d) < 1e-3) {
          done = true;
          return target;
        }
        return clamp(cur + d * Math.min(1, speed * dt), 0, 1);
      });
      if (!done) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, speed, enabled]);

  return value;
}
