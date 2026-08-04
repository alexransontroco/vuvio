export default function HelpAccordion({ categories, openId, onToggle }) {
  return (
    <div className="help-accordion">
      {categories.map((category) => (
        <section key={category.title} className="help-category">
          <h2>{category.title}</h2>
          <div className="help-category__items">
            {category.items.map((item) => {
              const id = `${category.title}-${item.question}`;
              const isOpen = openId === id;

              return (
                <article key={id} className={isOpen ? 'help-item is-open' : 'help-item'}>
                  <button type="button" aria-expanded={isOpen} onClick={() => onToggle(isOpen ? null : id)}>
                    <span>{item.question}</span>
                    <i aria-hidden="true" />
                  </button>
                  {isOpen ? <div className="help-item__answer">{item.answer}</div> : null}
                </article>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
