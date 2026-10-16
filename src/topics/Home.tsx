import { TOPICS, type TopicMeta } from './registry';
import { useNav } from '../nav';

function TopicCard({ meta }: { meta: TopicMeta }) {
  const setTopic = useNav((s) => s.setTopic);
  return (
    <button
      className={`topic-card${meta.ready ? '' : ' soon'}`}
      disabled={!meta.ready}
      onClick={() => meta.ready && setTopic(meta.id)}
    >
      <div className="topic-card-head">
        <h2>{meta.title}</h2>
        <span className={`badge${meta.ready ? ' ready' : ''}`}>
          {meta.ready ? '可学习' : '即将开通'}
        </span>
      </div>
      <p>{meta.summary}</p>
      <span className="topic-count">
        {meta.ready ? `${meta.chapterCount} 个章节 · 3D/2D 联动 · 拖拽实时验证` : '内容制作中'}
      </span>
    </button>
  );
}

export default function Home() {
  return (
    <div className="app home">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">⟋</span>
          <h1>工程制图 · 3D 交互学习</h1>
        </div>
      </header>
      <main className="home-main">
        <section className="home-hero">
          <h2>画法几何 · 交互式学习中心</h2>
          <p>
            每个主题都是"空间 ↔ 纸面"双视图联动教材:逐步讲解驱动投影体系,
            所有几何可拖拽,规律随拖动实时验证。
          </p>
        </section>
        <section className="topic-grid">
          {TOPICS.map((t) => (
            <TopicCard key={t.id} meta={t} />
          ))}
        </section>
      </main>
    </div>
  );
}
