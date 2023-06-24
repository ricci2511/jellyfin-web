
import libraryBrowser from '../../scripts/libraryBrowser';
import imageLoader from '../../components/images/imageLoader';
import listView from '../../components/listview/listview';
import loading from '../../components/loading/loading';
import { playbackManager } from '../../components/playback/playbackmanager';
import * as userSettings from '../../scripts/settings/userSettings';
import globalize from '../../scripts/globalize';
import Dashboard from '../../utils/dashboard';
import Events from '../../utils/events.ts';

import '../../elements/emby-itemscontainer/emby-itemscontainer';

export default function (view, params, tabContent) {
    function getPageData(context) {
        const key = getSavedQueryKey(context);
        let pageData = data[key];

        if (!pageData) {
            pageData = data[key] = {
                query: {
                    SortBy: 'Album,SortName',
                    SortOrder: 'Ascending',
                    IncludeItemTypes: 'Audio',
                    Recursive: true,
                    Fields: 'AudioInfo,ParentId',
                    StartIndex: 0,
                    ImageTypeLimit: 1,
                    EnableImageTypes: 'Primary'
                }
            };

            if (userSettings.libraryPageSize() > 0) {
                pageData.query['Limit'] = userSettings.libraryPageSize();
            }

            pageData.query.ParentId = params.topParentId;
            libraryBrowser.loadSavedQueryValues(key, pageData.query);
        }

        return pageData;
    }

    function getQuery(context) {
        return getPageData(context).query;
    }

    function getSavedQueryKey(context) {
        if (!context.savedQueryKey) {
            context.savedQueryKey = libraryBrowser.getSavedQueryKey('songs');
        }

        return context.savedQueryKey;
    }

    function reloadItems(page) {
        loading.show();
        isLoading = true;
        const query = getQuery(page);
        ApiClient.getItems(Dashboard.getCurrentUserId(), query).then(function (result) {
            function onNextPageClick() {
                if (isLoading) {
                    return;
                }

                if (userSettings.libraryPageSize() > 0) {
                    query.StartIndex += query.Limit;
                }
                reloadItems(tabContent);
            }

            function onPreviousPageClick() {
                if (isLoading) {
                    return;
                }

                if (userSettings.libraryPageSize() > 0) {
                    query.StartIndex = Math.max(0, query.StartIndex - query.Limit);
                }
                reloadItems(tabContent);
            }

            window.scrollTo(0, 0);
            const pagingHtml = libraryBrowser.getQueryPagingHtml({
                startIndex: query.StartIndex,
                limit: query.Limit,
                totalRecordCount: result.TotalRecordCount,
                showLimit: false,
                updatePageSizeSetting: false,
                addLayoutButton: false,
                sortButton: false,
                filterButton: false
            });
            const html = listView.getListViewHtml({
                items: result.Items,
                action: 'playallfromhere',
                smallIcon: true,
                artist: true,
                addToListButton: true
            });
            let elems = tabContent.querySelectorAll('.paging');

            for (let i = 0, length = elems.length; i < length; i++) {
                elems[i].innerHTML = pagingHtml;
            }

            elems = tabContent.querySelectorAll('.btnNextPage');
            for (let i = 0, length = elems.length; i < length; i++) {
                elems[i].addEventListener('click', onNextPageClick);
            }

            elems = tabContent.querySelectorAll('.btnPreviousPage');
            for (let i = 0, length = elems.length; i < length; i++) {
                elems[i].addEventListener('click', onPreviousPageClick);
            }

            const itemsContainer = tabContent.querySelector('.itemsContainer');
            itemsContainer.innerHTML = html;
            imageLoader.lazyChildren(itemsContainer);
            libraryBrowser.saveQueryValues(getSavedQueryKey(page), query);

            tabContent.querySelector('.btnShuffle').classList.toggle('hide', result.TotalRecordCount < 1);

            loading.hide();
            isLoading = false;

            import('../../components/autoFocuser').then(({ default: autoFocuser }) => {
                autoFocuser.autoFocus(page);
            });
        });
    }

    const self = this;
    const data = {};
    let isLoading = false;

    self.showFilterMenu = function () {
        import('../../components/filterdialog/filterdialog').then(({ default: filterDialogFactory }) => {
            const filterDialog = new filterDialogFactory({
                query: getQuery(tabContent),
                mode: 'songs',
                serverId: ApiClient.serverId()
            });
            Events.on(filterDialog, 'filterchange', function () {
                getQuery(tabContent).StartIndex = 0;
                reloadItems(tabContent);
            });
            filterDialog.show();
        });
    };

    function shuffle() {
        ApiClient.getItem(ApiClient.getCurrentUserId(), params.topParentId).then(function (item) {
            playbackManager.shuffle({ ...item, ...getQuery(tabContent) });
        });
    }

    self.getCurrentViewStyle = function () {
        return getPageData(tabContent).view;
    };

    function initPage(tabElement) {
        tabElement.querySelector('.btnFilter').addEventListener('click', function () {
            self.showFilterMenu();
        });
        tabElement.querySelector('.btnSort').addEventListener('click', function (e) {
            libraryBrowser.showSortMenu({
                items: [{
                    name: globalize.translate('OptionTrackName'),
                    id: 'Name'
                }, {
                    name: globalize.translate('Album'),
                    id: 'Album,SortName'
                }, {
                    name: globalize.translate('AlbumArtist'),
                    id: 'AlbumArtist,Album,SortName'
                }, {
                    name: globalize.translate('Artist'),
                    id: 'Artist,Album,SortName'
                }, {
                    name: globalize.translate('OptionDateAdded'),
                    id: 'DateCreated,SortName'
                }, {
                    name: globalize.translate('OptionDatePlayed'),
                    id: 'DatePlayed,SortName'
                }, {
                    name: globalize.translate('OptionPlayCount'),
                    id: 'PlayCount,SortName'
                }, {
                    name: globalize.translate('OptionReleaseDate'),
                    id: 'PremiereDate,AlbumArtist,Album,SortName'
                }, {
                    name: globalize.translate('Runtime'),
                    id: 'Runtime,AlbumArtist,Album,SortName'
                }, {
                    name: globalize.translate('OptionRandom'),
                    id: 'Random,SortName'
                }],
                callback: function () {
                    getQuery(tabElement).StartIndex = 0;
                    reloadItems(tabElement);
                },
                query: getQuery(tabElement),
                button: e.target
            });
        });
        tabElement.querySelector('.btnShuffle').addEventListener('click', shuffle);
    }

    initPage(tabContent);

    self.renderTab = function () {
        reloadItems(tabContent);
    };
}
