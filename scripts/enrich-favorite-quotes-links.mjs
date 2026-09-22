import fs from "node:fs/promises";

const DATA_FILE = new URL(
    "../assets/data/favorite-quotes.json",
    import.meta.url
);

const SOURCE_URLS = {
    "Animal Farm":
        "https://en.wikipedia.org/wiki/Animal_Farm",

    "Arrow":
        "https://en.wikipedia.org/wiki/Arrow_(TV_series)",

    "Atlas Shrugged":
        "https://en.wikipedia.org/wiki/Atlas_Shrugged",

    "Attack on Titan":
        "https://en.wikipedia.org/wiki/Attack_on_Titan",

    "Back to the Future":
        "https://en.wikipedia.org/wiki/Back_to_the_Future",

    "Castle":
        "https://en.wikipedia.org/wiki/Castle_(TV_series)",

    "Die Hard":
        "https://en.wikipedia.org/wiki/Die_Hard",

    "Dragon Ball":
        "https://en.wikipedia.org/wiki/Dragon_Ball",

    "Ender’s Game":
        "https://en.wikipedia.org/wiki/Ender%27s_Game",

    "Fear of Flying":
        "https://en.wikipedia.org/wiki/Fear_of_Flying_(novel)",

    "Ferris Bueller’s Day Off":
        "https://en.wikipedia.org/wiki/Ferris_Bueller%27s_Day_Off",

    "Friends":
        "https://en.wikipedia.org/wiki/Friends",

    "Fullmetal Alchemist":
        "https://en.wikipedia.org/wiki/Fullmetal_Alchemist",

    "Gravity Falls":
        "https://en.wikipedia.org/wiki/Gravity_Falls",

    "Hamlet":
        "https://en.wikipedia.org/wiki/Hamlet",

    "Harry Potter":
        "https://www.harrypotter.com/",

    "Harry Potter and the Sorcerer’s Stone":
        "https://www.harrypotter.com/discover/books/harry-potter-and-the-philosophers-stone",

    "How I Met Your Mother":
        "https://en.wikipedia.org/wiki/How_I_Met_Your_Mother",

    "Jurassic World: Fallen Kingdom":
        "https://en.wikipedia.org/wiki/Jurassic_World:_Fallen_Kingdom",

    "M*A*S*H":
        "https://en.wikipedia.org/wiki/M*A*S*H_(TV_series)",

    "Man and Superman":
        "https://en.wikipedia.org/wiki/Man_and_Superman",

    "Marvel Cinematic Universe":
        "https://www.marvel.com/movies",

    "Moby-Dick":
        "https://en.wikipedia.org/wiki/Moby-Dick",

    "Nineteen Eighty-Four":
        "https://en.wikipedia.org/wiki/Nineteen_Eighty-Four",

    "Pale Blue Dot":
        "https://en.wikipedia.org/wiki/Pale_Blue_Dot_(book)",

    "Pokémon":
        "https://www.pokemon.com/us",

    "Pokémon Emerald":
        "https://bulbapedia.bulbagarden.net/wiki/Pok%C3%A9mon_Emerald_Version",

    "Pokémon Omega Ruby and Alpha Sapphire":
        "https://bulbapedia.bulbagarden.net/wiki/Pok%C3%A9mon_Omega_Ruby_and_Alpha_Sapphire",

    "Pokémon: The First Movie":
        "https://bulbapedia.bulbagarden.net/wiki/M01",

    "Profiles of the Future":
        "https://en.wikipedia.org/wiki/Profiles_of_the_Future",

    "Quora":
        "https://www.quora.com/",

    "Richie Rich":
        "https://en.wikipedia.org/wiki/Richie_Rich_(film)",

    "Rocky Balboa":
        "https://en.wikipedia.org/wiki/Rocky_Balboa_(film)",

    "Rogue One: A Star Wars Story":
        "https://www.starwars.com/films/rogue-one",

    "Saturday Night Live":
        "https://www.nbc.com/saturday-night-live",

    "Spider-Man":
        "https://en.wikipedia.org/wiki/Spider-Man_(2002_film)",

    "Spider-Man 2":
        "https://en.wikipedia.org/wiki/Spider-Man_2",

    "Stanford Commencement Address":
        "https://news.stanford.edu/stories/2005/06/youve-got-find-love-jobs-says",

    "Star Wars":
        "https://www.starwars.com/",

    "Star Wars: Episode I – The Phantom Menace":
        "https://www.starwars.com/films/star-wars-episode-i-the-phantom-menace",

    "Stranger Things":
        "https://www.netflix.com/title/80057281",

    "Sudden Impact":
        "https://en.wikipedia.org/wiki/Sudden_Impact",

    "Supernatural":
        "https://en.wikipedia.org/wiki/Supernatural_(American_TV_series)",

    "The Adventures of Sharkboy and Lavagirl":
        "https://en.wikipedia.org/wiki/The_Adventures_of_Sharkboy_and_Lavagirl_in_3-D",

    "The Avengers":
        "https://www.marvel.com/movies/the-avengers",

    "The Chronicles of Narnia":
        "https://en.wikipedia.org/wiki/The_Chronicles_of_Narnia",

    "The Dark Knight":
        "https://en.wikipedia.org/wiki/The_Dark_Knight",

    "The Flash":
        "https://en.wikipedia.org/wiki/The_Flash_(2014_TV_series)",

    "The Good, the Bad and the Ugly":
        "https://en.wikipedia.org/wiki/The_Good,_the_Bad_and_the_Ugly",

    "The Hunger Games":
        "https://en.wikipedia.org/wiki/The_Hunger_Games",

    "The Legend of Zelda: Ocarina of Time":
        "https://www.zelda.com/about/",

    "The Lord of the Rings":
        "https://en.wikipedia.org/wiki/The_Lord_of_the_Rings",

    "The Mass Psychology of Fascism":
        "https://en.wikipedia.org/wiki/The_Mass_Psychology_of_Fascism",

    "The Matrix":
        "https://en.wikipedia.org/wiki/The_Matrix",

    "The Office":
        "https://en.wikipedia.org/wiki/The_Office_(American_TV_series)",

    "The Princess Bride":
        "https://en.wikipedia.org/wiki/The_Princess_Bride_(film)",

    "The Sandlot":
        "https://en.wikipedia.org/wiki/The_Sandlot",

    "The Social Network":
        "https://en.wikipedia.org/wiki/The_Social_Network",

    "The Sopranos":
        "https://www.hbo.com/the-sopranos",

    "The Tempest":
        "https://en.wikipedia.org/wiki/The_Tempest",

    "The Terminator":
        "https://en.wikipedia.org/wiki/The_Terminator",

    "The Wizard of Oz":
        "https://en.wikipedia.org/wiki/The_Wizard_of_Oz",

    "To Kill a Mockingbird":
        "https://en.wikipedia.org/wiki/To_Kill_a_Mockingbird",

    "Undertale":
        "https://undertale.com/",

    "Willy Wonka & the Chocolate Factory":
        "https://en.wikipedia.org/wiki/Willy_Wonka_%26_the_Chocolate_Factory",

    "Winnie-the-Pooh":
        "https://en.wikipedia.org/wiki/Winnie-the-Pooh"
};

const SPEAKER_URLS = {
    "Albert Einstein":
        "https://www.britannica.com/biography/Albert-Einstein",

    "Albus Dumbledore":
        "https://www.harrypotter.com/fact-file/characters-and-pets/albus-dumbledore",

    "Albus Percival Wulfric Brian Dumbledore":
        "https://www.harrypotter.com/fact-file/characters-and-pets/albus-dumbledore",

    "Anaïs Nin":
        "https://en.wikipedia.org/wiki/Ana%C3%AFs_Nin",

    "Anton Chekhov":
        "https://www.britannica.com/biography/Anton-Chekhov",

    "Arthur C. Clarke":
        "https://www.britannica.com/biography/Arthur-C-Clarke",

    "Aslan":
        "https://en.wikipedia.org/wiki/Aslan",

    "Atticus Finch":
        "https://en.wikipedia.org/wiki/Atticus_Finch",

    "Bill Cipher":
        "https://gravityfalls.fandom.com/wiki/Bill_Cipher",

    "Buckminster Fuller":
        "https://www.bfi.org/about-fuller/biography/",

    "C.S. Lewis":
        "https://www.britannica.com/biography/C-S-Lewis",

    "Captain America":
        "https://www.marvel.com/characters/captain-america-steve-rogers",

    "Carl Sagan, Pale Blue Dot":
        "https://science.nasa.gov/people/carl-sagan/",

    "Cicero":
        "https://www.britannica.com/biography/Cicero",

    "Darth Vader":
        "https://www.starwars.com/databank/darth-vader",

    "Doc Emmett Brown":
        "https://en.wikipedia.org/wiki/Emmett_Brown",

    "Dr. Seuss":
        "https://www.seussville.com/about-dr-seuss/",

    "Dr. Theodor Seuss Geisel":
        "https://www.seussville.com/about-dr-seuss/",

    "Dwight, quoting Michael Scott":
        "https://en.wikipedia.org/wiki/Dwight_Schrute",

    "Erica Jong":
        "https://en.wikipedia.org/wiki/Erica_Jong",

    "Ernest Hemingway":
        "https://www.britannica.com/biography/Ernest-Hemingway",

    "Ferris Bueller":
        "https://en.wikipedia.org/wiki/Ferris_Bueller",

    "Gandalf the Gray":
        "https://en.wikipedia.org/wiki/Gandalf",

    "George Bernard Shaw":
        "https://www.britannica.com/biography/George-Bernard-Shaw",

    "George Orwell":
        "https://www.orwellfoundation.com/the-orwell-foundation/orwell/biography/",

    "George R. R. Martin":
        "https://georgerrmartin.com/",

    "H.P. Lovecraft":
        "https://www.britannica.com/biography/H-P-Lovecraft",

    "Hamlet":
        "https://en.wikipedia.org/wiki/Prince_Hamlet",

    "Henry Thoreau":
        "https://www.britannica.com/biography/Henry-David-Thoreau",

    "Herman Melville, Moby Dick":
        "https://www.britannica.com/biography/Herman-Melville",

    "Inigo Montoya":
        "https://en.wikipedia.org/wiki/Inigo_Montoya",

    "Iron Man":
        "https://www.marvel.com/characters/iron-man-tony-stark",

    "James Baldwin":
        "https://www.britannica.com/biography/James-Baldwin",

    "Jedi Master Obi-Wan Kenobi":
        "https://www.starwars.com/databank/obi-wan-kenobi",

    "John Galt":
        "https://en.wikipedia.org/wiki/John_Galt",

    "Kurt Vonnegut":
        "https://www.vonnegutlibrary.org/",

    "Lando Calrissian":
        "https://www.starwars.com/databank/lando-calrissian",

    "Lao Tzu":
        "https://www.britannica.com/biography/Laozi",

    "Leo Tolstoy":
        "https://www.britannica.com/biography/Leo-Tolstoy",

    "Mark Twain":
        "https://www.britannica.com/biography/Mark-Twain",

    "Martin Luther King Jr.":
        "https://www.nobelprize.org/prizes/peace/1964/king/biographical/",

    "Marty McFly":
        "https://en.wikipedia.org/wiki/Marty_McFly",

    "Mewtwo":
        "https://bulbapedia.bulbagarden.net/wiki/Mewtwo_(Pok%C3%A9mon)",

    "Michael Scott":
        "https://en.wikipedia.org/wiki/Michael_Scott_(The_Office)",

    "Napoleon":
        "https://www.britannica.com/biography/Napoleon-I",

    "P. T. Barnum":
        "https://www.britannica.com/biography/P-T-Barnum",

    "Peter Parker":
        "https://www.marvel.com/characters/spider-man-peter-parker",

    "Princess Leia Organa":
        "https://www.starwars.com/databank/leia-organa",

    "Ralph Waldo Emerson":
        "https://www.britannica.com/biography/Ralph-Waldo-Emerson",

    "René Descartes":
        "https://www.britannica.com/biography/Rene-Descartes",

    "Rocky Balboa":
        "https://en.wikipedia.org/wiki/Rocky_Balboa",

    "Rumi":
        "https://www.britannica.com/biography/Rumi",

    "Sans":
        "https://undertale.com/about/",

    "Severus Snape":
        "https://www.harrypotter.com/fact-file/characters-and-pets/severus-snape",

    "Socrates":
        "https://www.britannica.com/biography/Socrates",

    "Stan Lee":
        "https://www.marvel.com/comics/creators/30/stan_lee",

    "Steve Jobs":
        "https://www.britannica.com/biography/Steve-Jobs",

    "Steven Spielberg":
        "https://www.britannica.com/biography/Steven-Spielberg",

    "Theodore Roosevelt":
        "https://www.britannica.com/biography/Theodore-Roosevelt",

    "Thanos":
        "https://www.marvel.com/characters/thanos",

    "Vincent Van Gogh":
        "https://www.vangoghmuseum.nl/en/art-and-stories/vincent-van-gogh",

    "Voltaire":
        "https://www.britannica.com/biography/Voltaire",

    "Walt Disney":
        "https://d23.com/about-walt-disney/",

    "Warren Buffett":
        "https://www.berkshirehathaway.com/",

    "Willy Wonka":
        "https://en.wikipedia.org/wiki/Willy_Wonka",

    "Winnie the Pooh":
        "https://en.wikipedia.org/wiki/Winnie-the-Pooh_(character)",

    "Yoda":
        "https://www.starwars.com/databank/yoda",

    "Yogi Berra":
        "https://baseballhall.org/hall-of-famers/berra-yogi"
};

const CREATOR_URLS = {
    "Ayn Rand":
        "https://aynrand.org/about/about-ayn-rand/",

    "C. S. Lewis":
        "https://www.britannica.com/biography/C-S-Lewis",

    "George Bernard Shaw":
        "https://www.britannica.com/biography/George-Bernard-Shaw",

    "George Orwell":
        "https://www.orwellfoundation.com/the-orwell-foundation/orwell/biography/",

    "Herman Melville":
        "https://www.britannica.com/biography/Herman-Melville",

    "J. K. Rowling":
        "https://www.jkrowling.com/about/",

    "J.R.R. Tolkien":
        "https://www.tolkiensociety.org/author/biography/",

    "Shakespeare":
        "https://www.shakespeare.org.uk/explore-shakespeare/shakespedia/william-shakespeare/",

    "William Shakespeare":
        "https://www.shakespeare.org.uk/explore-shakespeare/shakespedia/william-shakespeare/"
};

const PERFORMER_URLS = {
    "Alex Hirsch":
        "https://en.wikipedia.org/wiki/Alex_Hirsch",

    "Bruce Willis":
        "https://www.britannica.com/biography/Bruce-Willis",

    "Clint Eastwood":
        "https://www.britannica.com/biography/Clint-Eastwood",

    "Edie Falco":
        "https://en.wikipedia.org/wiki/Edie_Falco",

    "Frank Oz":
        "https://en.wikipedia.org/wiki/Frank_Oz",

    "Gene Wilder":
        "https://www.britannica.com/biography/Gene-Wilder",

    "James Earl Jones":
        "https://www.britannica.com/biography/James-Earl-Jones",

    "Johnny Depp":
        "https://www.britannica.com/biography/Johnny-Depp",

    "Justin Timberlake":
        "https://www.britannica.com/biography/Justin-Timberlake",

    "Mandy Patinkin":
        "https://en.wikipedia.org/wiki/Mandy_Patinkin",

    "Matthew Broderick":
        "https://en.wikipedia.org/wiki/Matthew_Broderick",

    "Rosemary Harris":
        "https://en.wikipedia.org/wiki/Rosemary_Harris",

    "Steve Carell":
        "https://www.britannica.com/biography/Steve-Carell",

    "Sylvester Stallone":
        "https://www.britannica.com/biography/Sylvester-Stallone",

    "Taylor Dooley":
        "https://en.wikipedia.org/wiki/Taylor_Dooley",

    "Tobey Maguire":
        "https://en.wikipedia.org/wiki/Tobey_Maguire",

    "Wentworth Miller":
        "https://en.wikipedia.org/wiki/Wentworth_Miller"
};

const data = JSON.parse(
    await fs.readFile(DATA_FILE, "utf8")
);

const additions = {
    source: 0,
    speaker: 0,
    dialogueSpeaker: 0,
    creator: 0,
    performer: 0,
    relatedPerson: 0
};

for (const quote of data.quotes) {
    if (quote.id === "music-makers-dreamers") {
        delete quote.source.location;

        quote.source.relatedLabel =
            "Adapted from";

        quote.source.relatedName =
            "Arthur O’Shaughnessy";

        if (!quote.source.relatedUrl) {
            quote.source.relatedUrl =
                "https://www.poetryfoundation.org/poets/arthur-o-shaughnessy";

            additions.relatedPerson += 1;
        }
    }

    if (
        quote.source?.title &&
        !quote.source.url &&
        SOURCE_URLS[quote.source.title]
    ) {
        quote.source.url =
            SOURCE_URLS[quote.source.title];

        additions.source += 1;
    }

    if (
        quote.source?.creator &&
        !quote.source.creatorUrl &&
        CREATOR_URLS[quote.source.creator]
    ) {
        quote.source.creatorUrl =
            CREATOR_URLS[quote.source.creator];

        additions.creator += 1;
    }

    const speaker =
        quote.attribution?.speaker;

    if (
        speaker &&
        !quote.attribution.url &&
        SPEAKER_URLS[speaker]
    ) {
        quote.attribution.url =
            SPEAKER_URLS[speaker];

        additions.speaker += 1;
    }

    const performer =
        quote.attribution?.performer;

    if (
        performer &&
        !quote.attribution.performerUrl &&
        PERFORMER_URLS[performer]
    ) {
        quote.attribution.performerUrl =
            PERFORMER_URLS[performer];

        additions.performer += 1;
    }

    for (const line of quote.lines || []) {
        if (
            line.speaker &&
            !line.speakerUrl &&
            SPEAKER_URLS[line.speaker]
        ) {
            line.speakerUrl =
                SPEAKER_URLS[line.speaker];

            additions.dialogueSpeaker += 1;
        }
    }
}

await fs.writeFile(
    DATA_FILE,
    `${JSON.stringify(data, null, 2)}\n`
);

console.log(
    `Updated ${DATA_FILE.pathname}`
);

console.table(additions);