import { useState } from 'react';
import LegalSection from '../components/LegalSection.jsx';
import SettingsLegalPage from '../components/SettingsLegalPage.jsx';
import { legalConfig } from '../data/legalConfig.js';

const SECTIONS = [
  'Respect other people',
  'Make sure people know when they are being filmed',
  'Protect privacy',
  'Keep live activities reasonably safe',
  'No serious violence or threats',
  'No sexual exploitation',
  'Protect minors',
  'Respect intellectual property',
  'No illegal content',
  'No spam or fake engagement',
  'Be honest about commercial relationships',
  'Questions and comments',
  'Equipment and gear',
  'Do not interfere with the Platform',
  'Reporting',
  'What happens when the rules are broken?',
  'Context matters',
  'Help build the kind of platform you want to use',
];

export default function CommunityGuidelinesPage() {
  const [summaryOpen, setSummaryOpen] = useState(false);

  return (
    <SettingsLegalPage title="Community Guidelines" label="Community Guidelines">
      <header className="legal-hero">
        <h1>Community Guidelines</h1>
        <p>Last updated: {legalConfig.lastUpdated}</p>
      </header>

      <p className="legal-intro">
        Vuvio is built around real people sharing real activities, skills, professions and passions through live video.
        These Community Guidelines explain what is and is not allowed on the Platform.
        They apply to live streams, profiles, comments, questions, replays, clips and any other content shared on Vuvio.
      </p>

      <section className="legal-summary">
        <button type="button" aria-expanded={summaryOpen} onClick={() => setSummaryOpen((v) => !v)}>
          Table of contents
          <span aria-hidden="true">{summaryOpen ? '-' : '+'}</span>
        </button>
        {summaryOpen ? (
          <nav aria-label="Community Guidelines sections">
            {SECTIONS.map((title, index) => (
              <a key={title} href={`#cg-${index + 1}`}>{index + 1}. {title}</a>
            ))}
          </nav>
        ) : null}
      </section>

      <LegalSection id="cg-1" title="1. Respect other people">
        <p>Treat other users with respect.</p>
        <p>Do not:</p>
        <ul>
          <li>harass, threaten or intimidate others;</li>
          <li>repeatedly target someone with abusive comments;</li>
          <li>encourage others to attack or harass a person;</li>
          <li>publish private information with the intent to harm;</li>
          <li>impersonate another person or organisation.</li>
        </ul>
        <p>Disagreement is allowed. Abuse is not.</p>
      </LegalSection>

      <LegalSection id="cg-2" title="2. Make sure people know when they are being filmed">
        <p>Vuvio is designed around live, real-world video.</p>
        <p>Before prominently filming another person, make sure you have any permission or consent required by law.</p>
        <p>Take extra care when filming:</p>
        <ul>
          <li>inside private homes;</li>
          <li>workplaces;</li>
          <li>customers or clients;</li>
          <li>children;</li>
          <li>people who may not reasonably expect to be filmed;</li>
          <li>confidential or sensitive environments.</li>
        </ul>
        <p>Do not deliberately broadcast someone in a private situation without their knowledge.</p>
      </LegalSection>

      <LegalSection id="cg-3" title="3. Protect privacy">
        <p>Do not share highly sensitive personal information about yourself or someone else.</p>
        <p>This includes information such as:</p>
        <ul>
          <li>passwords;</li>
          <li>bank details;</li>
          <li>identity documents;</li>
          <li>private home addresses;</li>
          <li>confidential medical information;</li>
          <li>private messages or communications;</li>
          <li>security codes.</li>
        </ul>
        <p>Remember that a live broadcast may be watched, recorded or shared by other people.</p>
      </LegalSection>

      <LegalSection id="cg-4" title="4. Keep live activities reasonably safe">
        <p>Vuvio is about seeing activities as they really happen, and some activities naturally involve risk.</p>
        <p>Creators may show tools, machinery, vehicles, workshops, kitchens, construction sites, sports or other potentially dangerous environments.</p>
        <p>However, do not:</p>
        <ul>
          <li>intentionally put yourself or others in serious danger for views;</li>
          <li>encourage viewers to attempt dangerous activities without proper training;</li>
          <li>use Vuvio to organise dangerous or illegal activity;</li>
          <li>deliberately ignore essential safety precautions for entertainment.</li>
        </ul>
        <p>Where appropriate, use professional equipment, supervision and safety procedures.</p>
      </LegalSection>

      <LegalSection id="cg-5" title="5. No serious violence or threats">
        <p>Do not use Vuvio to:</p>
        <ul>
          <li>make credible threats of violence;</li>
          <li>encourage people to physically harm someone;</li>
          <li>celebrate or promote serious acts of violence;</li>
          <li>coordinate violent activity.</li>
        </ul>
        <p>Real-world activities may sometimes involve potentially disturbing material. Context matters. Documentary, educational or professional content may be treated differently from content intended to glorify harm.</p>
      </LegalSection>

      <LegalSection id="cg-6" title="6. No sexual exploitation">
        <p>Sexual exploitation, abuse or coercion is prohibited.</p>
        <p>Any sexual content involving minors is strictly prohibited.</p>
        <p>Content involving child sexual abuse or exploitation may be reported to the relevant authorities.</p>
      </LegalSection>

      <LegalSection id="cg-7" title="7. Protect minors">
        <p>Do not exploit, endanger or sexualise minors.</p>
        <p>Creators should take particular care when children appear in live broadcasts.</p>
        <p>Do not reveal unnecessary personal information about a child, including information that could create a safety risk.</p>
        <p>Vuvio may restrict or remove content involving minors where necessary to protect them.</p>
      </LegalSection>

      <LegalSection id="cg-8" title="8. Respect intellectual property">
        <p>Only broadcast or upload material you have the right to use.</p>
        <p>Be especially careful with:</p>
        <ul>
          <li>music playing in the background;</li>
          <li>films and television;</li>
          <li>concerts;</li>
          <li>sporting events;</li>
          <li>copyrighted video;</li>
          <li>artwork;</li>
          <li>photographs;</li>
          <li>private performances.</li>
        </ul>
        <p>Owning a song, film or subscription does not automatically give you the right to rebroadcast it. A creator filming their own activity should also pay attention to copyrighted material audible or visible in the background.</p>
      </LegalSection>

      <LegalSection id="cg-9" title="9. No illegal content">
        <p>Do not use Vuvio to facilitate or promote illegal activity.</p>
        <p>This includes, for example:</p>
        <ul>
          <li>fraud;</li>
          <li>scams;</li>
          <li>trafficking;</li>
          <li>illegal sales;</li>
          <li>serious criminal activity;</li>
          <li>unlawful exploitation;</li>
          <li>instructions primarily intended to facilitate crime.</li>
        </ul>
        <p>Educational, documentary or journalistic discussion of illegal activity may be permitted depending on context.</p>
      </LegalSection>

      <LegalSection id="cg-10" title="10. No spam or fake engagement">
        <p>Do not:</p>
        <ul>
          <li>post repetitive unsolicited messages;</li>
          <li>create fake accounts to manipulate engagement;</li>
          <li>artificially inflate followers or reactions;</li>
          <li>use bots to create fake activity;</li>
          <li>conduct phishing;</li>
          <li>mislead people about your identity for fraudulent purposes.</li>
        </ul>
      </LegalSection>

      <LegalSection id="cg-11" title="11. Be honest about commercial relationships">
        <p>If you are paid, sponsored or otherwise compensated to feature a product, service or brand, make that relationship clear where required.</p>
        <p>The same applies to:</p>
        <ul>
          <li>gifted products;</li>
          <li>affiliate links;</li>
          <li>sponsored equipment;</li>
          <li>paid partnerships.</li>
        </ul>
        <p>Vuvio may provide dedicated disclosure tools as these features develop.</p>
      </LegalSection>

      <LegalSection id="cg-12" title="12. Questions and comments">
        <p>Questions are an important part of Vuvio. Viewers are encouraged to ask genuine questions about:</p>
        <ul>
          <li>the activity;</li>
          <li>the profession;</li>
          <li>techniques;</li>
          <li>equipment;</li>
          <li>experience;</li>
          <li>the creator's process.</li>
        </ul>
        <p>Do not use questions or comments to:</p>
        <ul>
          <li>harass the creator;</li>
          <li>repeatedly derail the live;</li>
          <li>publish personal information;</li>
          <li>spam;</li>
          <li>threaten someone;</li>
          <li>intentionally disrupt the session.</li>
        </ul>
        <p>Creators may ignore, hide or report inappropriate questions.</p>
      </LegalSection>

      <LegalSection id="cg-13" title="13. Equipment and gear">
        <p>Creators may show the equipment they use during an activity.</p>
        <p>When adding gear to a profile or live session:</p>
        <ul>
          <li>describe it accurately;</li>
          <li>do not pretend to own or use equipment that you do not;</li>
          <li>disclose sponsorships where relevant;</li>
          <li>avoid misleading claims about products.</li>
        </ul>
        <p>Displaying a product on Vuvio does not mean Vuvio endorses it.</p>
      </LegalSection>

      <LegalSection id="cg-14" title="14. Do not interfere with the Platform">
        <p>Do not attempt to:</p>
        <ul>
          <li>gain unauthorised access to accounts or systems;</li>
          <li>bypass security controls;</li>
          <li>deliberately disrupt live streams;</li>
          <li>distribute malicious software;</li>
          <li>exploit technical vulnerabilities;</li>
          <li>scrape or automate the Platform in ways that interfere with normal operation.</li>
        </ul>
        <p>If you discover a security issue, contact: <a href={`mailto:${legalConfig.contactEmail}`}>{legalConfig.contactEmail}</a></p>
      </LegalSection>

      <LegalSection id="cg-15" title="15. Reporting">
        <p>If you see content that appears to violate these Guidelines, report it through the available reporting tools.</p>
        <p>You may also contact: <a href={`mailto:${legalConfig.contactEmail}`}>{legalConfig.contactEmail}</a></p>
        <p>When reporting content, provide enough information for us to identify the relevant live stream, user, profile, comment, question, replay or other content. Reports are reviewed based on context, severity and applicable rules.</p>
      </LegalSection>

      <LegalSection id="cg-16" title="16. What happens when the rules are broken?">
        <p>Depending on the situation, Vuvio may:</p>
        <ul>
          <li>issue a warning;</li>
          <li>remove content;</li>
          <li>hide or limit content;</li>
          <li>end a live stream;</li>
          <li>restrict certain features;</li>
          <li>temporarily suspend an account;</li>
          <li>permanently remove an account.</li>
        </ul>
        <p>Serious violations may result in immediate action. Repeated violations may lead to stronger restrictions. Where appropriate, Vuvio may also report illegal activity to the relevant authorities.</p>
      </LegalSection>

      <LegalSection id="cg-17" title="17. Context matters">
        <p>Not every difficult, risky or sensitive subject is prohibited. Vuvio is intended to show real professions, environments and activities.</p>
        <p>We may take context into account when reviewing content, including whether it is:</p>
        <ul>
          <li>educational;</li>
          <li>documentary;</li>
          <li>professional;</li>
          <li>artistic;</li>
          <li>newsworthy;</li>
          <li>intended to promote harmful behaviour.</li>
        </ul>
        <p>However, context does not justify content that is clearly illegal or seriously harmful.</p>
      </LegalSection>

      <LegalSection id="cg-18" title="18. Help build the kind of platform you want to use">
        <p>Vuvio works best when creators show genuine activities and viewers are genuinely curious.</p>
        <p>Share what you know. Ask useful questions. Respect the people you encounter.</p>
        <p>And remember that behind every live stream is a real person.</p>
      </LegalSection>
    </SettingsLegalPage>
  );
}
