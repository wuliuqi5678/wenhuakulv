/**
 * 书目分类：把体裁归并成七个可浏览的类别。
 * 每个类别覆盖的体裁必须穷尽 books.json 里出现过的 genre。
 */
export const CATEGORIES = [
  {
    id: "novel",
    name: "长篇小说",
    genres: ["长篇小说"],
    desc: "用几十万字的耐心，写一个人、一个家族或一个村庄的沉浮。",
  },
  {
    id: "novella",
    name: "中篇小说",
    genres: ["中篇小说"],
    desc: "篇幅不长，力道却足；往往一刀切进时代与人心。",
  },
  {
    id: "history",
    name: "历史与纪实",
    genres: ["历史", "历史小说", "非虚构"],
    desc: "在史料与现场之间，重建被时间磨平的细节。",
  },
  {
    id: "essay",
    name: "散文随笔",
    genres: ["散文", "文化随笔", "学术随笔", "杂文"],
    desc: "一个人的目光、语气与见识，比故事更耐读。",
  },
  {
    id: "drama",
    name: "戏剧",
    genres: ["话剧"],
    desc: "舞台只有一方，却能装下半个世纪。",
  },
  {
    id: "children",
    name: "儿童文学",
    genres: ["儿童文学"],
    desc: "写给孩子的书，也写给还记得童年的人。",
  },
  {
    id: "scifi",
    name: "科幻",
    genres: ["科幻"],
    desc: "把镜头拉远，从宇宙尺度重新看人类。",
  },
];

/** 体裁 → 类别。未登记的体裁返回 null，便于校验。 */
export function categoryOf(genre) {
  return CATEGORIES.find((c) => c.genres.includes(genre)) ?? null;
}

/** 按类别分组，空类别自动略过。 */
export function groupByCategory(books) {
  return CATEGORIES.map((category) => ({
    ...category,
    books: books.filter((book) => category.genres.includes(book.genre)),
  })).filter((category) => category.books.length > 0);
}

/** 数据体检用：返回没有归入任何类别的体裁。 */
export function unmappedGenres(books) {
  return [...new Set(books.map((b) => b.genre))].filter((g) => !categoryOf(g));
}
