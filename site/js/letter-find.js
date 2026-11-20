// 手紙の届け先（国会議員）を探す補助UI。地方議員は letter-zip.js（郵便番号から）。検索内容はブラウザ内だけで処理する。
(() => {
  const form = document.getElementById('letterForm');
  const memberInput = form.querySelector('input[name="member"]');
  const openExternal = (url, label) => {
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = label;
    return link;
  };
  const normalize = (value) => value.trim().toLocaleLowerCase();

  const dietList = document.getElementById('dietMemberList');
  const dietNameFilter = document.getElementById('dietMemberFilter');
  const dietDistrictFilter = document.getElementById('dietDistrictFilter');
  function renderDietMembers() {
    const nameQuery = normalize(dietNameFilter.value);
    const districtQuery = normalize(dietDistrictFilter.value);
    const members = window.DIET_MEMBERS.filter((member) => {
      const nameText = normalize(`${member.name} ${member.kana}`);
      const districtText = normalize(`${member.house} ${member.district} ${member.party}`);
      return (!nameQuery || nameText.includes(nameQuery)) && (!districtQuery || districtText.includes(districtQuery));
    });
    dietList.replaceChildren();
    if (!nameQuery && !districtQuery) {
      dietList.textContent = `衆議院・参議院の議員 ${window.DIET_MEMBERS.length} 人から探せます。氏名か、選挙区・会派を入れてください。`;
      return;
    }
    if (!members.length) {
      dietList.textContent = '条件に一致する議員はいません。公式議員情報も確認してください。';
      return;
    }
    if (members.length > 30) {
      const more = document.createElement('p');
      more.className = 'hint-sm';
      more.textContent = `${members.length} 人が当てはまります。はじめの30人を出しています。条件を足して絞ってください。`;
      dietList.append(more);
    }
    members.slice(0, 30).forEach((member) => {
      const item = document.createElement('article');
      item.className = 'find-result';
      const heading = document.createElement('h4');
      heading.textContent = `${member.name}（${member.house}・${member.district}）`;
      const detail = document.createElement('p');
      detail.textContent = `${member.party} / ${member.kana}`;
      const actions = document.createElement('p');
      const useButton = document.createElement('button');
      useButton.type = 'button';
      useButton.className = 'btn btn-small';
      useButton.textContent = '議員名に入れる';
      useButton.addEventListener('click', () => {
        memberInput.value = member.name;
        memberInput.dispatchEvent(new Event('input', { bubbles: true }));
      });
      actions.append(useButton, ' ');
      if (member.officialUrl) actions.append(openExternal(member.officialUrl, '議員情報'));
      if (member.xHandle) actions.append(' ', openExternal(`https://x.com/${encodeURIComponent(member.xHandle)}`, 'Xを開く'));
      item.append(heading, detail, actions);
      dietList.append(item);
    });
  }
  dietNameFilter.addEventListener('input', renderDietMembers);
  dietDistrictFilter.addEventListener('input', renderDietMembers);
  const asOf = document.getElementById('dietAsOf');
  if (asOf && window.DIET_MEMBERS_AS_OF) {
    const [y, m, d] = window.DIET_MEMBERS_AS_OF.split('-').map(Number);
    asOf.textContent = `衆議院・参議院の公式サイトの議員一覧から作った名簿です（${y}年${m}月${d}日に取得）。改選・補欠選挙のあとと、毎月に取り直します。`;
  }
  renderDietMembers();

})();
