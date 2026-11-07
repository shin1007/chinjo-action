// 手紙の届け先を探す補助UI。検索内容はブラウザ内だけで処理する。
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

  const prefSelect = document.getElementById('prefAssemblySelect');
  const prefLink = document.getElementById('prefAssemblyLink');
  const prefNote = document.getElementById('prefAssemblyNote');
  window.PREF_ASSEMBLY_URLS.forEach((item) => {
    const option = document.createElement('option');
    option.value = item.pref;
    option.textContent = item.pref;
    prefSelect.append(option);
  });
  prefSelect.addEventListener('change', () => {
    const item = window.PREF_ASSEMBLY_URLS.find((entry) => entry.pref === prefSelect.value);
    if (!item) {
      prefLink.hidden = true;
      prefNote.textContent = '都道府県を選ぶと、公式サイトの議員名簿を開けます。';
      return;
    }
    prefLink.href = item.membersListUrl;
    prefLink.textContent = `${item.pref}議会 議員名簿を開く`;
    prefLink.hidden = false;
    prefNote.textContent = item.notes || '公式サイトの議員名簿で議員の連絡先を確認してください。';
  });

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

  const municipalityInput = document.getElementById('municipalityName');
  const municipalityOptions = document.getElementById('municipalityOptions');
  Object.values(window.MUNICIPALITIES).flat().forEach((name) => {
    const option = document.createElement('option');
    option.value = name.replace(/^.+?郡/, '');
    municipalityOptions.append(option);
  });
  const officialLink = document.getElementById('municipalityOfficialLink');
  const municipalitySearchLink = document.getElementById('municipalitySearchLink');
  const petitionLink = document.getElementById('municipalityPetitionLink');
  function updateMunicipalityLinks() {
    const municipality = municipalityInput.value.trim();
    const query = encodeURIComponent(`${municipality}議会 議員名簿`);
    municipalitySearchLink.href = `https://www.google.com/search?q=${query}`;
    petitionLink.href = `https://www.google.com/search?q=${encodeURIComponent(`${municipality}議会 陳情`)}`;
    officialLink.hidden = true;
    if (!municipality) return;
    const pref = Object.keys(window.MUNICIPALITIES).find((key) => window.MUNICIPALITIES[key].some((name) => name.replace(/^.+?郡/, '') === municipality));
    const sites = pref ? window.SITES[pref] || {} : {};
    const siteData = sites[municipality] || sites[Object.keys(sites).find((key) => key.replace(/^.+?郡/, '') === municipality)];
    if (siteData && siteData[2]) {
      officialLink.href = siteData[2];
      officialLink.hidden = false;
    } else if (siteData && siteData[1]) {
      officialLink.href = siteData[1];
      officialLink.hidden = false;
    }
  }
  municipalityInput.addEventListener('input', updateMunicipalityLinks);
  updateMunicipalityLinks();

  const xNameInput = document.getElementById('xMemberName');
  const xCouncilInput = document.getElementById('xCouncilName');
  const xSearchLink = document.getElementById('xSearchLink');
  const xMatches = document.getElementById('xMemberMatches');
  function updateXSearch() {
    const name = xNameInput.value.trim();
    const council = xCouncilInput.value.trim();
    const query = [name, council, '議員'].filter(Boolean).join(' ');
    xSearchLink.href = `https://x.com/search?q=${encodeURIComponent(query)}&f=user`;
    xMatches.replaceChildren();
    if (!name) return;
    const matches = window.DIET_MEMBERS.filter((member) => member.name === name && member.xHandle);
    matches.forEach((member) => {
      const result = document.createElement('p');
      result.append(`${member.name}（国会議員）: `, openExternal(`https://x.com/${encodeURIComponent(member.xHandle)}`, `@${member.xHandle}`), ' ');
      const useButton = document.createElement('button');
      useButton.type = 'button';
      useButton.className = 'btn btn-small';
      useButton.textContent = '議員名に入れる';
      useButton.addEventListener('click', () => {
        memberInput.value = member.name;
        memberInput.dispatchEvent(new Event('input', { bubbles: true }));
      });
      result.append(useButton);
      xMatches.append(result);
    });
  }
  xNameInput.addEventListener('input', updateXSearch);
  xCouncilInput.addEventListener('input', updateXSearch);
})();
