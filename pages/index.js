import { useState, useEffect, useRef } from "react";
import styles from "../styles/Home.module.css";

export default function Home() {
  const [query, setQuery] = useState("");
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeVideo, setActiveVideo] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
    fetchVideos("popular music 2024");
    inputRef.current?.focus();
  }, []);

  async function fetchVideos(searchQuery) {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setVideos(data.items || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function handleSearch(e) {
    e.preventDefault();
    if (query.trim()) fetchVideos(query.trim());
  }

  function formatCount(n) {
    if (!n) return "";
    const num = parseInt(n);
    if (num >= 1e6) return (num / 1e6).toFixed(1) + "M";
    if (num >= 1e3) return (num / 1e3).toFixed(0) + "K";
    return num;
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.logo}>
          <span className={styles.logoIcon}>▶</span>
          <span className={styles.logoText}>ViewTube</span>
        </div>
        <form onSubmit={handleSearch} className={styles.searchForm}>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search videos..."
            className={styles.searchInput}
          />
          <button type="submit" className={styles.searchBtn}>
            Search
          </button>
        </form>
      </header>

      <main className={styles.main}>
        {error && <div className={styles.error}>⚠ {error}</div>}

        {loading ? (
          <div className={styles.loader}>
            {[...Array(8)].map((_, i) => (
              <div key={i} className={styles.skeleton} />
            ))}
          </div>
        ) : (
          <div className={styles.grid}>
            {videos.map((video) => {
              const id = video.id?.videoId;
              const thumb = video.snippet?.thumbnails?.medium?.url;
              const title = video.snippet?.title;
              const channel = video.snippet?.channelTitle;
              const date = video.snippet?.publishedAt?.slice(0, 10);

              return (
                <div
                  key={id}
                  className={styles.card}
                  onClick={() => setActiveVideo(id)}
                >
                  <div className={styles.thumb}>
                    <img src={thumb} alt={title} loading="lazy" />
                    <div className={styles.playOverlay}>▶</div>
                  </div>
                  <div className={styles.cardInfo}>
                    <p className={styles.cardTitle}>{title}</p>
                    <span className={styles.cardMeta}>{channel} · {date}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {activeVideo && (
        <div className={styles.modal} onClick={() => setActiveVideo(null)}>
          <div className={styles.modalInner} onClick={(e) => e.stopPropagation()}>
            <button className={styles.closeBtn} onClick={() => setActiveVideo(null)}>✕</button>
            <iframe
              src={`https://www.youtube.com/embed/${activeVideo}?autoplay=1`}
              allow="autoplay; encrypted-media"
              allowFullScreen
              className={styles.iframe}
            />
          </div>
        </div>
      )}
    </div>
  );
}
