export default function CollectionCard({ collection }) {
  return (
    <article className="collection-card">
      <img src={collection.image} alt="" />
      <span className="collection-card__shade" />
      <div>
        <h3>{collection.title}</h3>
        <p>{collection.subtitle}</p>
      </div>
    </article>
  );
}
