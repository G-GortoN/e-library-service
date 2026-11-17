package dev.elibrary;

import java.time.Clock;
import java.util.Arrays;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.env.Environment;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
class SeedData implements ApplicationRunner {
  private final Store db;
  private final PasswordEncoder passwords;
  private final Environment environment;
  private final Clock clock;

  @Value("${app.seed-demo:false}")
  boolean demo;

  @Value("${app.admin-email:}")
  String adminEmail;

  @Value("${app.admin-password:}")
  String adminPassword;

  SeedData(Store db, PasswordEncoder passwords, Environment environment, Clock clock) {
    this.db = db;
    this.passwords = passwords;
    this.environment = environment;
    this.clock = clock;
  }

  @Override
  @Transactional
  public void run(ApplicationArguments args) {
    db.lock();
    if (adminEmail.isBlank() != adminPassword.isBlank())
      throw new IllegalStateException("Set both APP_ADMIN_EMAIL and APP_ADMIN_PASSWORD");
    if (!adminEmail.isBlank()) {
      String email = IdentityService.normalizeEmail(adminEmail);
      IdentityService.validatePassword(adminPassword);
      var existing = db.optional("select role from app_user where email=?", email);
      if (existing.isEmpty())
        db.update(
            "insert into app_user(email,display_name,password_hash,role,email_verified) values(?,?"
                + " ,?,'ADMIN',true)",
            email,
            "Library Administrator",
            passwords.encode(adminPassword));
      else if (!"ADMIN".equals(existing.get().get("role")))
        throw new IllegalStateException(
            "The bootstrap administrator email belongs to a reader; choose another address");
    }
    if (!demo
        || Arrays.stream(environment.getActiveProfiles())
            .noneMatch(p -> p.equals("local") || p.equals("demo"))) return;
    String password = passwords.encode("LibraryDemo2026!");
    for (String[] user :
        new String[][] {{"reader@example.com", "林间读者"}, {"reader2@example.com", "远山读者"}})
      db.update(
          "insert into app_user(email,display_name,password_hash,role,email_verified)"
              + " values(?,?,?,'READER',true) on conflict(email) do nothing",
          user[0],
          user[1],
          password);
    String[][] books = {
      {
        "Walden · 瓦尔登湖",
        "Henry David Thoreau",
        "自然随笔",
        "在湖畔的四季里，重新思考生活的尺度。A quiet exploration of nature, attention and deliberate living."
      },
      {
        "Pride and Prejudice · 傲慢与偏见",
        "Jane Austen",
        "文学",
        "机智、偏见与自我认识交织的经典。A sparkling study of character, manners and unexpected affection."
      },
      {
        "The Art of War · 孙子兵法",
        "孙武",
        "历史人文",
        "关于判断、策略与变化的古老智慧。An enduring reflection on strategy and decision-making."
      },
      {
        "A Room of One's Own · 一间自己的房间",
        "Virginia Woolf",
        "思想",
        "空间、创作与独立思考。An influential essay on creativity, independence and the conditions for"
            + " writing."
      },
      {
        "The Secret Garden · 秘密花园",
        "Frances Hodgson Burnett",
        "文学",
        "一座花园带来的友谊与成长。A story of curiosity, friendship and the healing power of a garden."
      },
      {
        "The Republic · 理想国",
        "Plato",
        "思想",
        "关于正义、教育与共同生活的对话。A foundational dialogue about justice and the life of a community."
      },
      {
        "On the Origin of Species · 物种起源",
        "Charles Darwin",
        "自然科学",
        "观察世界如何在漫长时间中变化。A landmark account of variation, adaptation and natural selection."
      },
      {
        "The Time Machine · 时间机器",
        "H. G. Wells",
        "科幻",
        "一次穿越未来的冒险与追问。A journey into the distant future and the possibilities of human society."
      },
      {
        "The Adventures of Sherlock Holmes · 福尔摩斯探案集",
        "Arthur Conan Doyle",
        "推理",
        "从细节中发现隐藏的逻辑。Twelve cases of observation, deduction and unexpected connections."
      },
      {
        "Little Women · 小妇人",
        "Louisa May Alcott",
        "文学",
        "四姐妹对家庭、成长与理想的探索。The lives, ambitions and friendships of the March sisters."
      },
      {
        "The Odyssey · 奥德赛",
        "Homer",
        "文学",
        "跨越海洋的归乡之旅。An epic voyage through danger, identity and the longing for home."
      },
      {
        "Meditations · 沉思录",
        "Marcus Aurelius",
        "思想",
        "在变化中练习清醒与克制。Personal reflections on character, attention and resilience."
      },
      {
        "The Jungle Book · 森林王子",
        "Rudyard Kipling",
        "文学",
        "森林里的规则、友谊与冒险。Stories of belonging and discovery in a vividly imagined wilderness."
      },
      {
        "Twenty Thousand Leagues Under the Seas · 海底两万里",
        "Jules Verne",
        "科幻",
        "潜入海洋深处的想象之旅。A submarine adventure through the wonders and mysteries of the sea."
      },
      {
        "The Call of the Wild · 野性的呼唤",
        "Jack London",
        "文学",
        "在辽阔荒野中寻找生命的力量。A powerful tale of adaptation, instinct and survival."
      },
      {
        "The Elements · 几何原本",
        "Euclid",
        "自然科学",
        "从公理出发理解图形与推理。A classic foundation for geometry and deductive reasoning."
      },
      {
        "The Wealth of Nations · 国富论",
        "Adam Smith",
        "历史人文",
        "分工、交换与社会繁荣的早期分析。A foundational inquiry into markets, work and prosperity."
      },
      {
        "The Picture of Dorian Gray · 道林·格雷的画像",
        "Oscar Wilde",
        "文学",
        "美、选择与自我欺骗的寓言。A provocative novel about beauty, conscience and consequence."
      },
      {
        "Around the World in Eighty Days · 八十天环游地球",
        "Jules Verne",
        "旅行",
        "一场关于时间与世界的旅行。An exuberant race across continents and cultures."
      },
      {
        "Leaves of Grass · 草叶集",
        "Walt Whitman",
        "诗歌",
        "在日常与广阔世界之间歌唱。Poems celebrating individuality, nature and shared human experience."
      },
      {
        "The Souls of Black Folk · 黑人的灵魂",
        "W. E. B. Du Bois",
        "历史人文",
        "历史、文化与身份的深刻思考。A collection of essays on history, identity and social life."
      },
      {
        "Alice's Adventures in Wonderland · 爱丽丝漫游奇境",
        "Lewis Carroll",
        "文学",
        "越过常识边界的奇妙旅程。A playful journey through language, logic and imagination."
      },
      {
        "The Voyage of the Beagle · 小猎犬号航海记",
        "Charles Darwin",
        "旅行",
        "沿着航程记录自然与发现。A naturalist's observations from an extraordinary voyage."
      },
      {
        "The War of the Worlds · 世界大战",
        "H. G. Wells",
        "科幻",
        "陌生来客带来的文明追问。A pioneering story of invasion, vulnerability and survival."
      }
    };
    for (int i = 0; i < books.length; i++) {
      String[] b = books[i];
      String isbn = "DEMO-" + String.format("%04d", i + 1);
      db.update(
          "insert into book(title,author,category,description,isbn,status,published_at)"
              + " values(?,?,?,?,?,'PUBLISHED',?) on conflict(isbn) do nothing",
          b[0],
          b[1],
          b[2],
          b[3],
          isbn,
          clock.instant().minusSeconds((long) i * 86400));
    }
  }
}
