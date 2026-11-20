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
    if (!members.length) {
      dietList.textContent = '条件に一致する議員はいません。公式議員情報も確認してください。';
      return;
    }
    members.forEach((member) => {
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
  renderDietMembers();

})();
